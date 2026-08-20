# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MovieX is an npm-workspaces monorepo managed by Turborepo.

- `apps/api` — NestJS backend (the active codebase; auth, entities, migrations all live here)
- `apps/web` — Next.js frontend on port 3001. Stack: Tailwind CSS v4, shadcn/ui, TanStack Query, lucide-react (see below). `app/page.tsx` is still the unmodified `create-turbo` demo page — no app-specific screens yet.
- `packages/shared-types` (`@moviex/shared-types`) — types shared between `api` and `web`; `src/movie.ts` and `src/user.ts` are currently empty stubs re-exported from `src/index.ts`
- `packages/ui`, `packages/eslint-config`, `packages/typescript-config` — shared React components / lint / tsconfig, consumed via `workspace:*`-style `"*"` deps

Root-level commands run through Turborepo across all workspaces; most day-to-day work happens inside `apps/api`.

## Commands

Run from repo root (Turborepo fans out per workspace):

```
npm run dev            # turbo run dev (all apps)
npm run build           # turbo run build
npm run lint             # turbo run lint
npm run check-types    # turbo run check-types
npm run format          # prettier --write "**/*.{ts,tsx,md}"
```

Filter to one workspace with `--filter`, e.g. `npx turbo dev --filter=api`.

### `apps/api` (NestJS)

```
npm run dev              # nest start --watch
npm run build             # nest build
npm run start:prod        # node dist/main
npm run lint               # eslint --fix
npm run test                # jest (unit)
npm run test:watch
npm run test:cov
npm run test:e2e           # jest -c ./test/jest-e2e.json
```

Run a single test file: `npx jest src/auth/auth.service.spec.ts` (jest `rootDir` is `src`, test files must match `*.spec.ts`).

### `apps/web` (Next.js)

```
npm run dev          # next dev --port 3001
npm run build
npm run check-types  # next typegen && tsc --noEmit
```

Add a shadcn component: `npx shadcn@latest add <component>` (run from `apps/web`).

### Database migrations (`apps/api`)

TypeORM CLI is driven entirely by `src/data-source.ts`, which loads `DATABASE_URL` from `.env` via `dotenv/config` and discovers entities with the glob `src/**/*.entity.ts` (new `*.entity.ts` files are picked up automatically — no manual registration needed there).

```
npm run migration:generate -- src/migrations/<Name>   # diffs entities against the live DB
npm run migration:run
npm run migration:revert
```

Always review a generated migration's SQL before running it — `migration:generate` connects to and diffs against the **real** database configured in `.env` (a remote Supabase Postgres instance in this project), so treat `migration:run` as a live schema change, not a local-only operation. `synchronize` is intentionally left disabled/commented out in `app.module.ts`'s `TypeOrmModule.forRootAsync` — schema changes go through migrations, not entity auto-sync.

## Architecture notes (`apps/api`)

- **Config**: `@nestjs/config` is global (`ConfigModule.forRoot({ isGlobal: true, load: configs })` in `app.module.ts`), loading `src/config/{app,database,jwt}.config.ts` via `registerAs`. Feature code injects typed config directly with `@Inject(xConfig.KEY)` / `ConfigType<typeof xConfig>` rather than calling `ConfigService.get('SOME_KEY')` with string literals — follow this pattern for new config (see `AuthService`'s `jwtConfig` injection). Note `database.config.ts` (namespace `'db'`) is currently unused — `TypeOrmModule.forRootAsync` reads `DATABASE_URL` straight off `ConfigService` instead.
- **Auth is hand-rolled, not Passport-based.** There is no `@nestjs/passport` or `@nestjs/jwt` in this project by design. `AuthService` calls the `jsonwebtoken` package directly (`jwt.sign` / `jwt.verify`), using `jwt.config.ts` (`JWT_SECRET`, `JWT_EXPIRES_IN`) as the single source of truth for signing options. Passwords are hashed with `bcrypt` before insert; `password` has no DB-level uniqueness constraint.
- **Auth is cookie-based, not bearer.** The access token is delivered as an **httpOnly `access_token` cookie** set by `POST /auth/login`; it is deliberately _not_ in the response body, so frontend JavaScript never holds the raw token. `Authorization: Bearer` is no longer accepted anywhere. The cookie name and its attributes live once in `src/auth/auth.constants.ts` (`ACCESS_TOKEN_COOKIE`, `accessTokenCookieOptions()`) — login, logout and the guard all import from there, and login/logout must pass **identical** attributes or the browser won't treat clear-cookie as matching the set cookie. `main.ts` registers `cookieParser()` (without it `req.cookies` is undefined and every guarded route 401s) and credentialed CORS against `FRONTEND_URL` — a wildcard origin is invalid with `credentials: true` and silently breaks cookies.
- **Route protection**: `src/auth/guards/jwt-auth.guard.ts` (`JwtAuthGuard`) is a plain `CanActivate` that reads the token from `req.cookies[ACCESS_TOKEN_COOKIE]`, verifies it via `jwt.verify` (injected `jwtConfig`) and attaches the decoded payload to `request.user` (typed via the `src/auth/types/express.d.ts` module augmentation). Pull the current user in a handler with the `@CurrentUser()` decorator (`src/auth/decorators/current-user.decorator.ts`). Protect a route with `@UseGuards(JwtAuthGuard) @ApiCookieAuth('access-token')` — the `'access-token'` name must match the scheme registered in `main.ts`'s `DocumentBuilder.addCookieAuth(..., 'access-token')`. There is no "Authorize" button to paste a token into: sign in via `POST /auth/login` from the docs page itself and, because Swagger UI is same-origin, the browser carries the cookie on every later "Try it out" call.
- **No refresh tokens, no server-side session.** The JWT has a fixed expiry (`JWT_EXPIRES_IN`) and that is the whole lifetime. `POST /auth/logout` only clears the browser's cookie — the token stays cryptographically valid until it expires, since there is no denylist. Don't add refresh-token machinery without a deliberate decision to.
- **Entities** live in `src/entity/*.entity.ts` and must be registered in the owning feature module's `TypeOrmModule.forFeature([...])` for runtime DI (`autoLoadEntities: true` picks these up for the app; the CLI's `data-source.ts` finds them independently via its own glob — the two are separate registration paths, see the migrations section above).
- **Swagger** is served at `/docs` (`main.ts`), built from a single global `DocumentBuilder` — add new tags/bearer schemes there, not per-module.
- **Global `ValidationPipe`** (`whitelist`, `transform`, `forbidNonWhitelisted`) is set once in `main.ts`; DTOs rely on `class-validator` decorators only (no per-route pipe setup needed).

## Architecture notes (`apps/web`)

- **Tailwind CSS v4** — no `tailwind.config.js`; theming is CSS-first via `@theme inline` in `app/globals.css`, which `@import "tailwindcss"` and is processed through `@tailwindcss/postcss` (`postcss.config.mjs`). Light/dark tokens (`--background`, `--primary`, `--sidebar-*`, etc.) are CSS variables on `:root` / `.dark`, not Tailwind config theme keys — add new design tokens there, not in a config file.
- **shadcn/ui** is configured via `components.json` (style `base-nova`, base color `neutral`, CSS variables on). Components are generated into `components/ui/*` with `npx shadcn@latest add <component>` and are plain source files you own/edit directly, not an npm dependency — this preset builds on **Base UI** (`@base-ui/react`), not Radix. Import alias `@/*` maps to `apps/web/*` (`tsconfig.json`); use `@/components`, `@/lib`, `@/hooks` per `components.json`'s aliases. The `cn()` class-merging helper is in `lib/utils.ts` (`clsx` + `tailwind-merge`).
- **MovieX design tokens — never hard-code a colour in a component.** Every product surface/text colour is a `--mx-*` CSS variable declared twice in `app/globals.css`: light values on `:root`, dark overrides in `.dark` (values-only overrides — tokens identical in both themes, like `--mx-accent`, live only on `:root` and are inherited). They are exposed to Tailwind through `@theme inline` as `--color-mx-*`, so components use utilities: `bg-mx-nav`, `bg-mx-card`, `bg-mx-field` (inset field, e.g. modal inputs), `bg-mx-field-raised` (raised field, e.g. the navbar search), `border-mx-border` / `border-mx-border-subtle`, `text-mx-fg` / `-muted` / `-subtle` / `-faint`, `bg-mx-accent` / `hover:bg-mx-accent-hover` / `text-mx-on-accent`, `text-mx-success`, `bg-mx-backdrop`, the `mx-avatar-*` set, and `font-mx` (the system-sans stack the designs use). Colours picked in JS (e.g. the password-strength meter) pass `var(--mx-strength-weak|medium|strong)` rather than hex, so they theme too. A new component that hard-codes hex will not respond to the theme switcher — add a token instead.
- **Dark/light switching** is `next-themes` (`ThemeProvider` in `app/providers.tsx`, `attribute="class"` → `.dark` on `<html>`, `defaultTheme="dark"`), with `suppressHydrationWarning` on `<html>` in `layout.tsx`. `components/layout/ThemeToggle.tsx` is the switcher; it decides which icon shows with the `dark:` variant rather than a `mounted` effect, which keeps it SSR-safe with no hydration mismatch — copy that pattern instead of gating render on `useEffect`.
- **Base-layer resets**: anything global in `globals.css` must sit inside `@layer base`. Unlayered CSS outranks Tailwind's utility layer, so a bare `* { padding: 0; margin: 0 }` silently kills every `p-*`/`m-*` utility in the app (this bit us once already).
- **lucide-react** is `components.json`'s configured `iconLibrary`, but the auth/nav components use **`@tabler/icons-react`** (outline), which is what the design references specify.
- **TanStack Query** is wired up in `app/providers.tsx` (`QueryClientProvider`, client created inside `useState` so SSR requests don't share a cache). Server-state calls belong in hooks like `hooks/use-auth.ts` (`useLoginMutation` / `useRegisterMutation`), not inline in components. Note it only covers async/server state — DOM concerns (scroll lock, key listeners, focus) are still plain effects.
- **UI copy is English, and lives in `*_COPY` constants.** English is the base language of the app — there is no Turkish/Azerbaijani copy left, and new strings should not reintroduce any. Each feature keeps its strings in one object (`DISCOVER_COPY` in `lib/constants/discover.ts`, `FOOTER_COPY` in `lib/constants/footer.ts`); add a key there rather than inlining a literal in JSX. The exceptions already in the tree are `aria-label`s on one-off layout controls (Navbar, ThemeToggle) — fine to leave inline, but still English. Numbers format through `DISCOVER_LOCALE` (`'en-US'`), so grouping matches the copy; keep the two in step if the language ever changes. **No i18n library** — `next-intl` is a deliberate later step, so don't wire up translation machinery ad hoc.
- **Shared types**: import domain types _and validation_ from `@moviex/shared-types` rather than redefining them locally. The package ships raw TS source (`exports` → `./src/index.ts`), so `next.config.js` lists it in `transpilePackages`. `src/auth.ts` holds the zod schemas both apps validate against (`loginSchema`, `registerSchema`, plus the `passwordSchema` / `PASSWORD_MIN_LENGTH` pieces the UI reuses — e.g. the strength meter parses against the same `min(8)` rule instead of duplicating it).

## Genres come from TMDB — never hard-code them

There is **no static genre list anywhere in this repo**, and adding one back is a regression. Genres are fetched live:

- `apps/api` proxies TMDB at **`GET /tmdb/genres`** (`src/tmdb/`), returning TMDB's array **unchanged** as `{ id: number, name: string }[]`. Don't rename or reshape those fields — `id` is exactly the value TMDB's `/discover/movie` takes as `with_genres`, so it passes straight through with no lookup table on either side. The route is public (no guard); `TmdbService` uses Node's global `fetch` (there is no HTTP-client dependency, and `@nestjs/axios` is not installed) with `TMDB_API_KEY` injected via `src/config/tmdb.config.ts` following the usual `registerAs` pattern.
- `apps/web` fetches it in `lib/api.ts` with `next: { revalidate: 86400 }` — **Next's `fetch` cache is the only caching layer**, deliberately: no Redis, no database. `app/page.tsx` (a Server Component) calls it and passes `genres` down as props; the array never lives in client state.
- The shared `Genre` type is `packages/shared-types/src/genre.ts`, used by the service return type, the Swagger response (via `GenreDto`, which `implements Genre` so drift fails to compile), and every web component.
- A movie's genre is stored as `Movie.genreId` (a TMDB numeric id) and its **name is resolved at render time** against the fetched list — never stored on the movie.
- Selection lives in the **URL**, not state: `?genre=28`. `GENRE_SEARCH_PARAM` and `parseGenreParam()` in `lib/constants/discover.ts` are shared by the page (reads) and the chips (write), so the two cannot disagree. The "Tümü" chip is not a TMDB genre — it **deletes** the param rather than writing an "all" sentinel, and `null` means "no genre filter" throughout. A non-numeric param falls back to `null`.

## TMDB endpoints: normalise on the way out, and cache per-endpoint

`GET /tmdb/genres` and `GET /tmdb/discover` (both public, both in `src/tmdb/`) deliberately behave differently in three ways. Match the existing one when adding a third endpoint.

- **Pass through vs. normalise.** Genres are returned in TMDB's exact shape because `id` is the `with_genres` value. Discover results are **not**: `TmdbService.toMovieSummary()` is the only place TMDB's snake_case is read, expanding `poster_path` into a full `https://image.tmdb.org/t/p/w500/…` URL (**`null` stays `null`** — concatenating it yields a URL ending in `null` that 404s) and slicing `release_date` to a four-digit `releaseYear` (`null` for TMDB's `""` undated entries). Web components are typed against `MovieSummary` / `DiscoverMoviesResponse` directly — there is no adapter layer, so an API shape change fails to compile.
- **Cache lifetime is per-endpoint, and Next's `fetch` is the only cache** (no Redis, no DB). Genres: `next: { revalidate: 86400 }`. Discover: `cache: "no-store"` — results vary per filter combination and shift with TMDB popularity, so nothing is reusable.
- **Failure mode differs on purpose.** `getGenres()` degrades to `[]` (an optional filter; losing it must not take down the page or the build). `getDiscoverMovies()` **throws**, and `TmdbService.discoverMovies()` never returns an empty page on error — an empty grid reads as "no films match this filter", which is a different and misleading claim. There is no `app/error.tsx` yet, so a discover failure currently renders Next's default 500.
- `discoverMovies(params)` accepts `yearFrom` / `yearTo` / `minRating` but does not forward them yet — the chips are still stubs. Fill in the TODO there rather than changing the signature. `page` is capped at `TMDB_MAX_PAGE` (500) because TMDB 400s above it, which would otherwise surface as a bogus 503.

### Movie detail (`/movie/[tmdbId]`)

- **`append_to_response`, never extra round trips.** `GET /tmdb/:tmdbId` fetches `/movie/{id}?append_to_response=credits,videos` — cast, crew and trailers are *not* in the base payload, but appending them keeps it to **one** upstream request instead of three, which matters for both latency and TMDB's rate limit. Any further sub-resource (`images`, `recommendations`, …) belongs in that same list, not in a second call.
- **Route order matters.** `@Get(':tmdbId')` is declared **last** in `TmdbController`. Nest matches in declaration order, so a wildcard above `genres` / `discover` / `search` would swallow them and answer `/tmdb/genres` with "no movie with id genres". `ParseIntPipe` is the second line of defence.
- A TMDB **404 maps to our 404** (opt-in per call via `request()`'s `notFoundMessage`); every other upstream status stays a 503, because it means TMDB is broken, not that the caller asked for something absent.
- **Cached one hour** (`next: { revalidate: 3600 }`), deliberately unlike search/discover's `cache: 'no-store'`: a single movie is a stable resource, while result lists depend on a query and shift with TMDB popularity. Pick the cache policy from whether the resource is stable, not by habit.
- **Elements overlapping a backdrop need their own separation treatment.** A film's backdrop and poster come from the same palette, so the poster's top half dissolves into the band it overlaps. Two things fix it and both are required: a `--mx-hero-overlay` (`rgba(0,0,0,0.42)`) layer above the image but below the controls — which also makes white button text readable over bright backdrops — and a **light hairline** `--mx-poster-edge` plus a lift shadow on the poster. A page-background-coloured border does *not* work: it separates the poster from the page, not from the backdrop. The same applies to anything else placed over artwork later.
- **Signed-out users see normal, enabled buttons that open `LoginRegisterModal`.** `MovieActions` gates every library action through one `runAction()` helper. Hiding or disabling the buttons would remove the affordance that motivates signing up, so the modal is the gate, not the UI state.
- `MovieActions` renders one of three layouts from a single `status` prop (`null | 'watchlist' | 'watched'`). Wiring the real user-movies module later means changing the data source, not restructuring the component.
- **`posterTone()` lives in `lib/poster-tone.ts`, not in a component.** It used to be exported from `MovieCard`, which is `"use client"` — a Server Component calling it is a runtime error ("attempted to call … from the server"), which the detail page hit. Pure helpers shared across the boundary belong in `lib/`.

### TMDB fields are patchy — type them nullable end-to-end

TMDB's catalogue is not uniformly populated, and a field that is present on every popular title can be missing on an obscure one. Assuming otherwise has already shipped one crash: `vote_average` is absent on some entries (measured: 1 in ~770 search results, e.g. "Bay Area Godfathers Collection" on page 7 of a "godfather" search), so `rating` arrived as `undefined` and `value.toFixed(1)` threw.

The rule for any new TMDB-derived field:

- **Type it `T | null`** in `MovieSummary` (or wherever it lands) the moment TMDB can omit it. `rating` and `releaseYear` are both nullable for this reason.
- **Normalise in `TmdbService.toMovieSummary`**, never at the render site — that is the single place TMDB's wire format is read, so one guard covers discover, search, and anything added later. Collapse every "no value" variant to `null` there.
- **Distinguish "absent" from "zero".** `vote_average: 0` with `vote_count: 0` means *unrated*, not *rated zero* — ~8% of search results hit this. Rendering "0.0" beside a star would state something false, so `toRating()` maps it to `null` too.
- **Handle `null` at every render site,** and decide per layout: `MovieCard` drops the badge (it floats over artwork with nothing to align to), `MovieRow` keeps its column with a muted `—` (dropping it would shunt the action button and break alignment down the list), the typeahead drops star and number together. `DISCOVER_COPY.rating()` returns `null` for `null` precisely so callers are forced to branch rather than silently interpolating.

### Search (`/search?q=…`)

- **`GET /tmdb/search` takes `q` and `page` only.** TMDB's `/search/movie` supports neither `with_genres`, `vote_average.gte` nor `sort_by` — it ranks by relevance. Genre/rating/sort params lingering in the browser URL from a Discover visit are deliberately **not** forwarded; TMDB would ignore them silently, which reads as a broken filter. The results page says "Sorted by relevance" for exactly this reason, and shows no filter bar. An empty/whitespace `q` is a **400**, never sent upstream (TMDB answers it with a 422 that would surface as a bogus 503).
- **`PaginatedMoviesResponse`** (`packages/shared-types/src/movie.ts`) is the shared envelope for discover *and* search — they differ in how results are chosen, not in what a page looks like. `DiscoverMoviesResponse` remains as a deprecated alias. This is why `/search` reuses Discover's `MovieGrid`, `MovieList`, `ViewToggle` and `Pagination` unchanged rather than growing parallel components; `Pagination` takes a `pathname` prop so it can point at `/search`.
- **`/search` redirects to `DISCOVER_HREF` when `q` is missing or blank** — there is no meaningful search page without a query. Note Discover lives at **`/`**, not `/discover`; use the `DISCOVER_HREF` constant rather than hard-coding either.
- **Typeahead debounce pattern** (`components/search/SearchTypeahead.tsx` + `hooks/use-debounced-value.ts`): the raw input stays in the component's own state so a keystroke never re-renders the navbar, and the **debounced** value — never the raw one — goes into the TanStack Query key. That is what actually collapses typing into one request; debouncing only the UI would still key a new query per keystroke, and a superseded key is abandoned automatically. `enabled` gates on the debounced length (`SEARCH_MIN_QUERY_LENGTH`). Keyboard nav only moves an index in state.
- **`NEXT_PUBLIC_API_URL` must be set in any deployed environment.** `lib/api.ts` is called from both Server Components (`API_URL`) and, via the typeahead, the **browser** — where a server-only var is `undefined`. The public variable is the one Next inlines into the client bundle.
- Poster thumbnails use `next/image`, which is why `next.config.js` allowlists `image.tmdb.org` under `images.remotePatterns`. Any new remote image host needs adding there or it will not render.

### Discover filters live in the URL

Every filter is a search param read by the Server Component, never client state — so a filtered view is linkable and paginating re-runs the server fetch. Each param gets a `*_SEARCH_PARAM` constant plus a `parse*Param()` guard in `lib/constants/discover.ts`, shared by whatever reads and whatever writes it; follow that pair when adding one.

- `?genre=<tmdbId>` — written by the chips, cleared (not set to a sentinel) by "Tümü".
- `?page=<n>` — 1-based, **omitted for page 1** rather than written as `?page=1`. `parsePageParam()` clamps everything out of range (`0`, negatives, `abc`, `9999`) into `[1, MAX_PAGE]` **server-side**, so a hand-edited URL can never reach TMDB and error. `MAX_PAGE` (500) mirrors the API's `TMDB_MAX_PAGE`, and the pagination UI clamps `totalPages` by it too.
- `?yearFrom=<y>&yearTo=<y>` and `?minRating=<n>` — written together by the filter popovers. Both are **omitted at their defaults** (the full 1950–current span, and "Any rating"): the default is not a filter, so it stays out of the URL *and* out of the TMDB query. `app/page.tsx` checks `isFullYearRange` before forwarding — sending the full span would silently drop pre-1950 and undated releases from an unfiltered browse. `parseYearParam()` / `parseMinRatingParam()` clamp or discard anything out of range.
- `?sort=<MovieSortId>` — our own vocabulary (`popularity` | `rating` | `newest` | `oldest`), **not** TMDB's `sort_by` string. `SORT_OPTIONS` in `lib/constants/discover.ts` is the single place the two are mapped (`sortByFor()`), so the URL carries `?sort=rating` rather than leaking `vote_average.desc`, and a bookmarked link survives a change in TMDB's vocabulary. The default (`popularity`) is omitted from the URL, like every other filter default; `parseSortParam()` falls back to it for anything unrecognised.
- **Sort is a plain menu, not a draft popover.** `SortDropdown.tsx` reuses `FilterPopover` only for its trigger and open/close plumbing (overriding the panel padding with `p-1.5`) — picking an option commits and closes immediately, because there is nothing to stage. Draft state is for filters with several inputs to set before committing; a single-choice control should not make the user press Apply.
- **Filter popovers hold draft state; only "Apply" commits.** `components/discover/FilterPopover.tsx` is the shared shell (trigger chip, outside-click, Escape) — deliberately *not* the genre chip, which is a one-click toggle that commits immediately. The draft lives in each filter component and is reseeded from the applied props via `onOpenChange`, so closing by Escape or outside-click discards it with no extra bookkeeping. "Reset" clears the draft without closing or committing. Commit goes through `useApplyFilters()` (`hooks/use-filter-params.ts`), which merges into the existing params — never dropping `genre` — and always resets `page`. Outside-click listens on `mousedown`, not `click`, so dragging a slider thumb past the panel edge doesn't dismiss it.
- Pagination is numbered only — **no "load more", no infinite scroll**; a page selection fully replaces the results. `Pagination.tsx` is a Server Component whose controls are plain `<Link>`s that copy every existing param forward, so paginating never drops the active genre. Each href ends in `#results` (`RESULTS_ANCHOR_ID`, with `scroll-mt-16` clearing the sticky navbar) — that is what scrolls the grid back into view, no client scroll effect.

## Movie list flow (Listem → İzlediklerim)

There are exactly **two** things a user can do with a film — put it in **Listem**, and mark it in **İzlediklerim**. This is the whole model right now; it may grow later, but treat it as closed until this section says otherwise.

1. A film the user has not saved has no state at all (`Movie.userState` absent/`null`). Its action is **Ekle**, which adds it to **Listem**.
2. A film in Listem is `userState: 'listed'` and shows the `Listede` tag. Its action is **İzledim**, which tags it watched.
3. A watched film is `userState: 'watched'` and shows the `İzlendi` tag. It keeps the **Ekle** action, because Listem and İzlediklerim are separate lists — having seen a film does not put it in the list.

Consequences to respect when touching the discover screens:

- **Every row/card always offers an action; no state renders an empty button slot.** Only `listed` swaps `Ekle` for `İzledim`.
- **There is no rating action anywhere in this flow.** A `Puanla` button existed briefly on the list row and was deliberately removed; do not reintroduce rating (or any third state) without updating this section first. `Movie.rating` is the _catalogue's_ score — display-only, not something the user sets here.
- `MovieUserState` (`'watched' | 'listed'`) in `packages/shared-types/src/movie.ts` is the single definition of the two states; `userState` is optional because the API omits it for signed-out users, so "absent" and "not in the list" are the same case in the UI.
- All copy lives in `DISCOVER_COPY` (`apps/web/lib/constants/discover.ts`): `add` / `markWatched` for the actions, `listed` / `watched` for the tags. Never inline these strings in a component.
- The state tag renders through `components/discover/StatusTag.tsx`, shared by the grid card and the list row so the label/colour mapping cannot drift between views.
- The list row derives its button from `ROW_ACTIONS` in `components/discover/MovieRow.tsx`, a total map keyed by state (`satisfies Record<MovieUserState | 'none', RowAction>`, so a new state fails to compile until it has an action). Adding a state means adding an entry there, not a conditional at the call site.
- `userState` being a single enum cannot express "in Listem **and** watched". Today `'watched'` wins and the row still offers `Ekle`; if both need to show at once, that is a change to `MovieUserState`, not to the components.

### Discover result views (`apps/web/components/discover/`)

`MovieGrid` (poster cards) and `MovieList` (ranked rows) are the two renderings of the same result set and take **prop-compatible** signatures, so the view toggle swaps one for the other without reshaping data. `DiscoverSection.tsx` is the client boundary that owns the active `viewMode` and renders the hero plus the matching view — `app/page.tsx` stays a server component, which is why the toggle state lives there and not on the page. `MovieList` renders every row inside one bordered, hairline-divided surface (`bg-mx-card`), not as separate cards per film. `Movie.runtimeMinutes` and `Movie.overview` are optional and consumed only by the list row; the grid card has no room for them.

# MovieX — Development Notes

## Verification policy

- Do NOT use Playwright or browser automation to verify UI changes.
- Do NOT take screenshots to self-check work.
- After writing code, just report what you changed — I will test/verify
  visually and functionally myself (via browser or Swagger).
- Exception: only use browser verification if I explicitly ask for it.
