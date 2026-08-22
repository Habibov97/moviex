# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MovieX is an npm-workspaces monorepo managed by Turborepo.

- `apps/api` — NestJS backend (the active codebase; auth, entities, migrations all live here)
- `apps/web` — Next.js frontend on port 3001. Stack: Tailwind CSS v4, shadcn/ui, TanStack Query, next-intl (en/tr/ru), lucide-react (see below). Every route lives under `app/[locale]/` — Discover (`/`), Search, movie detail and My List — and `app/[locale]/layout.tsx` is the root layout; there is no `app/layout.tsx`.
- `packages/shared-types` (`@moviex/shared-types`) — the contract both apps are typed against: `movie.ts`, `genre.ts`, `user-movie.ts`, `locale.ts`, and the zod auth schemas in `auth.ts`, all re-exported from `src/index.ts`. It ships **raw TS source**, so `apps/web` lists it in `transpilePackages` and `apps/api` may only import *types* from it — see the TMDB language note for what breaks otherwise.
- `packages/ui`, `packages/eslint-config`, `packages/typescript-config` — shared React components / lint / tsconfig, consumed via `workspace:*`-style `"*"` deps

Root-level commands run through Turborepo across all workspaces.

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
- **Auth is cookie-based, not bearer.** The access token is delivered as an **httpOnly `access_token` cookie** set by `POST /auth/login`; it is deliberately _not_ in the response body, so frontend JavaScript never holds the raw token. `Authorization: Bearer` is no longer accepted anywhere. The cookie name and its attributes live once in `src/auth/auth.constants.ts` (`ACCESS_TOKEN_COOKIE`, `accessTokenCookieOptions()`) — login, logout and the guard all import from there, and login/logout must pass **identical** attributes or the browser won't treat clear-cookie as matching the set cookie. `main.ts` registers `cookieParser()` (without it `req.cookies` is undefined and every guarded route 401s) and credentialed CORS against `FRONTEND_URLS` — a wildcard origin is invalid with `credentials: true` and silently breaks cookies. See the LAN-testing section for that variable's format.
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
- **UI copy lives in `messages/{en,tr,ru}.json`, never in a component.** The app is fully internationalised with **next-intl** (English, Turkish, Russian) — see the i18n section below for the whole convention. The old `*_COPY` constant objects are gone; `lib/constants/*.ts` now holds only structure (search-param names, option ids, parsers), and each option's *label* is a message key derived from its id. Never inline a user-visible string in JSX, and never add one to a single message file — a key must exist in **all three** or the other two render an error placeholder.
- **Shared types**: import domain types _and validation_ from `@moviex/shared-types` rather than redefining them locally. The package ships raw TS source (`exports` → `./src/index.ts`), so `next.config.js` lists it in `transpilePackages`. `src/auth.ts` holds the zod schemas both apps validate against (`loginSchema`, `registerSchema`, plus the `passwordSchema` / `PASSWORD_MIN_LENGTH` pieces the UI reuses — e.g. the strength meter parses against the same `min(8)` rule instead of duplicating it).

## Internationalisation (next-intl): routing, messages, TMDB language

Three languages — **English (default), Turkish, Russian** — via **next-intl**. This is now a baseline convention: every feature added from here on has to follow it, and a hard-coded string is a bug, not a shortcut.

### Locale routing: `localePrefix: 'always'`

Every URL carries its language, English included: `/en`, `/tr/my-list`, `/ru/movie/603`. The default locale is **not** left unprefixed. Two reasons, the first specific to this app:

1. **The locale is not only a UI setting — it is data.** It is forwarded to TMDB as `lang`, so titles, overviews and genre names change with it. An unprefixed `/movie/603` would render *different content* per visitor depending on their `Accept-Language`, and a link shared between two people would not show the same description. With `always`, a URL means exactly one thing.
2. Every route has one canonical shape, so the language switcher is a plain segment swap and "preserve the current path" needs no special case for the default language.

The cost is one redirect on `/` → `/en` for a first visit. That is the trade accepted; don't switch to `as-needed` without revisiting point 1.

- `i18n/routing.ts` — `defineRouting`, the single place the locale list and prefix strategy live.
- `i18n/request.ts` — loads `messages/{locale}.json` per request; an unknown locale falls back to English rather than throwing.
- `proxy.ts` — `createMiddleware(routing)`. Named `proxy.ts`, not `middleware.ts`: Next 16 deprecated the old filename. Same contract, so next-intl's output drops straight in. **It is not an auth guard** — `/my-list` still protects itself client-side via `useCurrentUser`.
- `app/[locale]/layout.tsx` is the app's **root layout**; there is deliberately no `app/layout.tsx`. `<html lang>` can only be set where the locale is known.

### Always import navigation from `@/i18n/navigation`

`i18n/navigation.ts` re-exports locale-aware `Link`, `redirect`, `useRouter`, `usePathname` from `createNavigation(routing)`. **Use these, never the `next/link` and `next/navigation` originals**, anywhere a route is written or read:

- `<Link href="/my-list">` renders `/tr/my-list` under Turkish without the caller knowing. A raw `next/link` drops the prefix and the proxy bounces the user back to the default language.
- `usePathname()` answers `/my-list`, **prefix stripped** — which is what keeps `Navbar`'s active-link test and every `router.push` that rebuilds a query string written against plain routes.

`useSearchParams` and `notFound` are locale-independent and still come from `next/navigation`. Server-side `redirect` needs the locale passed explicitly: `redirect({ href: DISCOVER_HREF, locale })`.

**Don't call `useSearchParams()` in anything the layout renders.** `LanguageSwitcher` sits in the navbar on every page; subscribing there opted the whole app shell out of static rendering and failed the build with a missing-suspense bailout on `/my-list`. It reads `window.location.search` inside the click handler instead — the value is only needed at click time, when there is definitely a `window`.

### Message files

`messages/en.json`, `tr.json`, `ru.json` — one file per language, same key structure, grouped by feature: `meta`, `nav`, `language`, `discover`, `detail`, `search`, `myList`, `footer`, `errors`, `auth`. These mirror the `*_COPY` objects they replaced, with search split out of `discover` into its own namespace.

- Server Components: `getTranslations('discover')` / `getFormatter()`. Client Components: `useTranslations('discover')` / `useFormatter()`. Getting these the wrong way round is a runtime error, not a type error.
- **Option labels are derived from ids**, never stored beside them: `SORT_OPTIONS` holds `{ id, sortBy }` and the label is `t(\`sort.${id}\`)`. So `?sort=rating` and "Highest rated" cannot drift, and a new option is one entry plus three keys.
- Key parity is checkable: flatten all three files and diff the key sets. They must be identical — 193 keys as of writing.

### Plurals and numbers go through ICU, not string concatenation

Russian has four plural categories (`one`/`few`/`many`/`other`) where English has two and Turkish effectively one. **Never** build a count phrase by concatenating a formatted number with a noun.

```json
"results": "{count, plural, one {# result} other {# results}}"
"results": "{count, plural, other {# sonuç}}"
"results": "{count, plural, one {# результат} few {# результата} many {# результатов} other {# результата}}"
```

`#` inside a plural is formatted with the locale's grouping automatically, which is why `Intl.NumberFormat` and the old `DISCOVER_LOCALE` constant are gone: `1,171,518 results` / `1.171.463 sonuç` / `1 171 448 результатов` all fall out of the same call. Pass the raw number as `count` and let ICU do both jobs.

- **A number that is not a count must be passed as a string**, or ICU groups it: `t('copyright', { year: String(year) })` renders "© 2026", not "© 2,026". Same for the year-range chip.
- **Ratings use `format.number(value, RATING_NUMBER_FORMAT)`, not `toFixed(1)`** — the decimal separator is part of the locale, so Russian shows `8,4`.
- **Dates use `format.dateTime(date, RELEASE_DATE_FORMAT)`**. `lib/constants/discover.ts` exports `parseIsoDate()` (parsing only, returns `null` for a missing or unparseable value) plus the format objects; the formatting itself happens at the call site, which knows the locale.
- `formatLanguage(code, locale)` and the language switcher's own list use `Intl.DisplayNames` — TMDB can return any ISO 639-1 code, and a hand-maintained map would need translating three times over.
- A unit rendered *beside* a separately-styled number still needs the plural: `myList.statUnit` is `{count, plural, ...}` with no `#`, so Russian gets "фильм/фильма/фильмов" agreeing with the figure above it.

### Validation messages are keys, not English

`packages/shared-types/src/auth.ts` is still the one place the auth *rules* live, but each zod `message` is now a **key** (`nameTooShort`, `passwordsDoNotMatch`, …) listed in `AUTH_VALIDATION_KEYS`. `LoginRegisterModal` is the only place that turns one back into text, via `useValidationMessage()`, passing the length constants as ICU parameters. Don't put English into a schema message.

The one deliberate exception: Nest's `ValidationPipe` field messages on a signup 400 are surfaced verbatim, because the API has no notion of the caller's language and faking a translation would be worse. The client-side zod rules catch the same cases first and *are* translated, so this is a backstop.

### The language switcher

`components/layout/LanguageSwitcher.tsx`, in the navbar. Globe + locale code + chevron; the panel lists each language by its **native** name (`English` / `Türkçe` / `Русский`), never translated — someone who has landed on a locale they cannot read has to recognise their own. Active row gets `bg-mx-typeahead-active` and an accent checkmark. Outside-`mousedown` and Escape close it, the same convention as `UserMenu` and `FilterPopover`.

Selecting a language calls `router.replace(pathname + window.location.search, { locale })`, so the current route *and* its filters survive the switch. Navigating through next-intl's router is also what persists the choice — it updates the `NEXT_LOCALE` cookie the proxy reads next visit.

Every colour comes from an existing `--mx-*` token (`bg-mx-field-raised` is the same surface as the navbar search, `border-mx-border-subtle`, `bg-mx-card`, `bg-mx-typeahead-active`, `text-mx-accent`), so it themes. Its height is `h-9 md:h-8` to match `ThemeToggle` and the avatar rather than the reference's literal 7px padding — the reference draws all three the same height.

**Below `md` it moves into the mobile menu** and is hidden from the top row. At 320px that row only just fits the hamburger, wordmark and three 36px controls; a ~62px pill tips it into overflow.

### TMDB content language: the `lang` param, and the English fallback

`GET /tmdb/{genres,discover,search,:id}` all accept `?lang=en|tr|ru` (`LangQueryDto`, which `DiscoverQueryDto` and `SearchQueryDto` extend so the global `forbidNonWhitelisted` doesn't reject it). An unknown value is a **400**, not a silent default.

- **The mapping to TMDB's tag (`tr` → `tr-TR`) lives in `apps/api/src/tmdb/tmdb-language.ts`, not in `shared-types`.** Two reasons. TMDB's wire format is only ever read in the API, so the vocabulary belongs there — the same split as `MovieSortId` → `sort_by`. And, load-bearing: **`apps/api` must only import *types* from `@moviex/shared-types`, never values.** That package ships raw `.ts` with extensionless barrel re-exports; Next transpiles it, but `node dist/main` cannot resolve them and the API dies at boot with `ERR_MODULE_NOT_FOUND`. It worked before only because every API import was `import type` and got erased. `API_LOCALES` is derived from the map's keys, and `satisfies Record<Locale, string>` means adding a fourth language to `LOCALES` fails to compile until it has a TMDB tag.
- **Web side:** `lib/api.ts` takes `locale` on every call and appends `lang`. Server Components read it from the `[locale]` route param; the navbar typeahead is the one browser-side caller and reads `useLocale()`, with `locale` in its TanStack Query key so switching language re-fetches instead of showing the previous language's titles.
- **Caching is per-locale for free.** `lang` is part of the request URL and Next keys its `fetch` cache by URL, so genres stay 24h-cached and a movie 1h-cached *per language* — no change to the cache policy was needed.

**The fallback: TMDB's translations are patchy, and a blank description reads as a broken page.** Measured: 5 of 20 results on Turkish discover page 3 have an empty `overview`. Two conditional paths, both in `TmdbService`, both skipped entirely when the locale is English or nothing is missing:

- `englishProseFor()` — one movie. Re-fetches `/movie/{id}` with `language=en-US` and borrows `overview` *and* `tagline` (both come free from the same request). `append_to_response` is omitted: credits and videos already arrived with the first call and are language-agnostic.
- `withEnglishOverviews()` — a page of results. Re-runs the **same** discover/search query with `language=en-US` and matches on `id`. That is **one** extra upstream request instead of twenty per-movie detail calls, and the result set is identical because every other parameter is unchanged.

Both **degrade rather than throw**: a missing description is cosmetic, and taking the page down over it would be a worse outcome than the blank it is avoiding. A film TMDB has no overview for in *any* language still ends up `null` and renders `detail.noOverview` — which is correct.

`title` needs no fallback: TMDB already returns the original title when it has no localised one.

### Editing a message file may need `.next` cleared

Turbopack does not reliably invalidate its build cache when a `messages/*.json` changes — `i18n/request.ts` reaches them through a template-literal `import()`, which is resolved as a glob. Symptom: a newly added key renders fine in dev but the built page still serves the old catalogue, so the string comes out blank or as an error placeholder on a prerendered route. Hit once while adding My List's sign-in copy. If a message change does not show up after `npm run build`, `rm -rf .next` and rebuild.

### Adding a feature from here on

1. Add every string to **all three** `messages/*.json` under the right namespace. A key present in one file only renders an error placeholder in the others.
2. Any count in a sentence is `{count, plural, …}` with all four Russian categories. Any non-count number is passed as a string.
3. Route hrefs and `useRouter`/`usePathname` come from `@/i18n/navigation`.
4. If it fetches TMDB, thread the locale through and pass `lang`.
5. Structure (ids, params, parsers) goes in `lib/constants/*.ts`; the label is a message key derived from the id.

## My List (`/my-list`)

- **The navbar has two links, Discover and My list — there is no standalone "Watched".** It was removed once this page grew its Watchlist/Watched tabs; the tab is the canonical way in, and the old link pointed at a `/izlediklerim` route that never existed.
- **Route is `/{locale}/my-list`** (`/my-list` in code — the `Link` from `@/i18n/navigation` adds the prefix). The navbar and footer links were updated from the old Turkish `/listem` placeholder, which never had a page behind it.
- **Auth protection is client-side and renders in place — it does not redirect.** No route-level guard pattern exists in this app, so `MyListView` reads `useCurrentUser` and branches into **three** states, in this order:
  1. `isAuthLoading` → `MyListSkeleton`, a pulsing mirror of the real layout. Auth is *unknown* here, so neither other branch can be trusted yet; treating unknown as signed-out is what would flash the sign-in prompt at someone who is actually logged in.
  2. confirmed `!isSignedIn` → `components/my-list/SignInRequired.tsx`. Nothing else renders — no heading, stats, tabs or grid — because each would describe a list this visitor does not have.
  3. signed in → the list.
- **It used to `router.replace(DISCOVER_HREF)` instead; don't reinstate that.** Silently landing someone on a different page with no explanation reads as a broken link, and it threw away the one moment where signing up has an obvious payoff. The navbar's "My list" link is deliberately *not* gated either — the page does the gating.
- **Signing in from that state needs no redirect or reload.** The modal's success path invalidates `['auth','me']`, `useCurrentUser` re-reads, and branch 3 takes over — the same way every other auth-dependent surface updates. `SignInRequired` opens `LoginRegisterModal` directly on the register view for "Sign up" by setting `defaultMode` and `isOpen` in the same render; the modal latches `defaultMode` on the closed→open transition, so both must be committed together.
- **One combined query, filtered client-side.** `GET /user-movies` with **no** status filter, under `['user-movies','list','all']`. Both tabs, all three stats and the sort derive from that one array. Per-status requests would mean two caches to invalidate and a stats bar that can disagree with the tab above it — and every mutation already invalidates the `['user-movies']` root, so this updates for free.
- **Sorting is client-side** for the same reason: the whole list is already in memory. Note the "Rating" sort option is a **stub** — `user_movies` stores no rating (there is no rating feature) so it falls back to recency rather than appearing broken.
- **Saved entries are snapshots, and snapshots are not translated.** `title` / `posterUrl` / `primaryGenre` were stored in whatever language the user was browsing when they saved the film, and they come from our own database, not TMDB. Switching language translates the page's chrome, not the cards. Re-saving refreshes them (every `POST` writes the snapshot again). Accepted trade-off — the alternative is a TMDB call per row on every visit.
- **`primaryGenre`** is the one column added for this page: a single genre **name** snapshotted at save time, alongside `title`/`posterUrl`/`releaseYear`. Enough to tally a "top genre" across both tabs without a TMDB call or a relation table; `—` when nothing saved carries one. The name is resolved client-side from the live genre list (`useLibraryActions({ genres })`), since `MovieSummary` carries genre **ids**.
- **Cards here are not Discover cards.** No permanent overlay button on the face — actions appear on hover (`[@media(hover:none)]:hidden`), with a `⋯` menu as the touch-device counterpart (`[@media(hover:hover)]:hidden`). The watched badge is the one thing that stays visible.
- The page renders **client-side only**: `useSearchParams` (tab + sort) opts the subtree out of static prerendering, so its HTML is empty and everything renders after hydration. Expected for a per-user page — but it means `curl` shows nothing; check it in a browser.

## `user-movies`: saved lists

A movie is either on the **watchlist** or **watched**. There is no rating and no review — `UserMovieStatus` is the whole model, and `MovieUserState` is now an alias of it so cards, the detail page and the table all speak one vocabulary.

**Endpoints** (all behind `JwtAuthGuard`; `userId` always comes from the token, never the body):

| Route | Notes |
|---|---|
| `POST /user-movies` | **Idempotent** — creates, or updates status + snapshot if the pair exists. A double-clicked Add never 409s. |
| `PATCH /user-movies/:tmdbId` | Status only. **404 if nothing is saved** — POST is what creates. |
| `DELETE /user-movies/:tmdbId` | 204, or 404 if nothing is saved. |
| `GET /user-movies?status=` | The caller's list, newest-updated first. Backs the future "My List" page. |
| `GET /user-movies/status?tmdbIds=1,2,3` | **Batch lookup** — see below. |

- **Snapshot fields are denormalised on purpose.** `title` / `posterUrl` / `releaseYear` are stored on the row, sent by the client from whatever card it acted on. The client already holds them, so saving costs no TMDB round trip, and "My List" renders from our own database instead of one TMDB call per saved row. Accepted trade-off: a retitled or re-postered film keeps its values until a later write refreshes them (every `POST` does).
- **`watchedAt`** is stamped entering `watched` and cleared leaving it. An existing timestamp is preserved on re-save, so re-adding a watched film does not move the date.
- **Batch status, never N requests.** `useMovieStatuses(tmdbIds)` issues one `/user-movies/status` call for everything on screen. Ids with no entry are **omitted** from the response — `map.get(id) === undefined` *is* "not in list", so nothing is encoded for the common case. Disabled while signed out.
- **Query keys for user-owned data must carry the user id: `['user-movies', userId, …]`.** Build them with `userMoviesKey(user?.sub)` from `hooks/use-user-movies.ts` — never assemble one by hand. Mutations still invalidate the bare `['user-movies']` root and reach everything beneath it, because React Query matches keys by **prefix**; that is what keeps a Discover badge updating after a change made on a detail page. Add new queries under `userMoviesKey(...)` rather than inventing sibling keys.

### Data isolation: the cross-account cache leak, and what actually caused it

Two accounts used in the same browser once saw **the same** Watchlist/Watched list. Worth reading before touching anything user-owned, because the half everyone suspects was not the problem.

**The backend was never at fault, and was verified end to end rather than assumed.** Every `user-movies` endpoint takes `userId` from the token (`@CurrentUser() user` → `user.sub`, signed as `{ sub: user.id }` in `AuthService.login`) and filters on it; the service has no query without a `userId` in its `where`. Confirmed at runtime with two forged tokens for real accounts: `GET /user-movies` returned one row for user 13 and zero for user 15; `PATCH` and `DELETE` against the other user's `tmdbId` both 404 via the shared `requireEntry(userId, tmdbId)`; and a `userId` planted in a `POST` body is rejected 400 by the global `forbidNonWhitelisted` before it reaches the service. The schema backs this up — `UQ_user_movies_user_tmdb (userId, tmdbId)` and an FK to `users(id)`.

**The leak was entirely client-side, in the TanStack Query cache.** Two compounding faults:

1. `['user-movies', …]` carried **no user id**, so every account shared one cache entry.
2. `useLogoutMutation` only called `invalidateQueries({ queryKey: ['auth','me'] })`. That marks *one* key stale and **deletes nothing** — the previous user's list stayed in the cache untouched.

So: A signs in, their list is cached. A signs out — cache keeps it. B signs in, My List mounts, asks for the *same key*, and React Query serves A's data. And because `providers.tsx` sets a global `staleTime: 60_000`, within that window it does not even refetch — B does not glimpse A's list, B **keeps** it. Nothing was wrong with any request; the wrong answer never came from the server.

**Both layers are now fixed, defence in depth:**

- **Keys are per-account** (`userMoviesKey`), so a different user is structurally a different cache entry. This is the durable fix — it holds even on the path with no logout at all, such as a session that simply expires before someone else signs in.
- **Logout calls `queryClient.removeQueries()`** with no filter, deleting every cached query. Deliberately *not* `queryClient.clear()`: that also wipes the mutation cache, and it runs from inside a mutation that is still settling — including the one whose `isPending` the logout button renders. Identical outcome for cached data. Nothing valuable is lost, because Discover and Search render from Server Components; only the typeahead caches, and it refetches on the next keystroke.
- **Login calls `removeQueries({ queryKey: USER_MOVIES_KEY })`** before announcing the new session, covering the expired-session-then-different-user path.
- **`MyListView` no longer builds its own key.** It had an inline `useQuery` duplicating `useUserMovies()`; that was a second place the scoping had to be remembered, so it now calls the hook. One hook, one key.

**Rule for any future user-owned feature:** the id goes in the query key, and the fix belongs in *both* layers — a correctly scoped API does not save you from a cache keyed without the user. When auditing, check what `invalidateQueries` actually does: it marks stale, it does not remove. Use `removeQueries` when the goal is that data must become unreadable.
- The unique constraint is `(userId, tmdbId)`; the index is `(userId, status)`, which is exactly what the batch lookup and the status-filtered list query on.
- **"Mark as watched" uses POST, not PATCH.** It is reachable from a card for a movie that may not be saved yet, and PATCH 404s on a missing entry; POST covers both cases. PATCH is only used for "Move back to list", where the entry is known to exist.

## Auth submit: endpoints, field mapping, and register → login

`LoginRegisterModal` submits through `hooks/use-auth.ts`. Several details are easy to get wrong because the brief-level names do not match the API:

- **The route is `POST /auth/signup`, not `/auth/register`.**
- **`RegisterDto` wants `userName`, not `name`**, and the API's global `forbidNonWhitelisted` means any extra property is a **400**. So the signup body is exactly `{ userName, email, password }` — `confirmPassword` is client-side only — and the login body is exactly `{ email, password }`. Sending `rememberMe` returns `400 "property rememberMe should not exist"`; it is a UI concern and never goes on the wire.
- **A duplicate account returns `404` ("User already exists"), not `409`.** Match on the status the backend actually returns.
- `NAME_MIN_LENGTH` in `@moviex/shared-types` is **4**, aligned with `RegisterDto`'s `@MinLength(4)`. If those drift, a name passes client validation and then 400s server-side.

**Register does not sign anyone in** — `/auth/signup` deliberately sets no cookie. The modal uses **approach (b)**: on signup success it immediately chains a `/auth/login` with the same credentials, so the user never retypes what they just chose, then closes like a normal login. If that follow-up call fails it falls back to **(a)**: switch to the login view with the email pre-filled and an "Account created — sign in below" notice, rather than leaving someone holding an account they appear not to have.

Only `AuthError` messages (curated in `use-auth.ts`) are rendered; anything else falls back to generic copy, so raw upstream text and stack detail never reach the UI. `useLoginMutation` invalidates `['auth','me']` on success — that, not a reload, is what flips the navbar and the gated buttons.

## Client auth state: `useCurrentUser` and the `['auth','me']` key

`hooks/use-current-user.ts` is the **single source of truth** for "is someone signed in, and who". Anything that needs to know — the library-action gate, the navbar account control, and the modal's submit once it lands — reads this hook rather than tracking its own flag or calling `/auth/me` again.

- **Query key is `['auth','me']`** (`CURRENT_USER_QUERY_KEY`). Invalidate it after any change to the session — login, register, logout — and every consumer re-reads. `useLogoutMutation` already does this in `onSettled` (settled, not success: a failed logout leaves the cookie's state unknown, so re-reading is right either way).
- **A 401 is the logged-out answer, not an error** → the query resolves to `null`, with `retry: false` so React Query doesn't hammer a correct rejection. `staleTime` is 5 minutes.
- **`credentials: "include"` is mandatory** on every auth call: the token is an httpOnly cookie JS cannot read, so the browser must be told to attach it cross-origin. This is also why the API's CORS has to name the exact origin — see the LAN-testing section.
- **`/auth/me` returns the decoded JWT payload — `{ sub, email, iat, exp }`, with no name.** `initialsFromEmail()` derives the avatar's initials from the email local part. If real-name initials are wanted, `/auth/me` has to be widened to join the user row; don't invent a name client-side.
- **Gating is three-way, never two.** `useLibraryActions().requireAuth()` no-ops while auth is *loading*, opens the modal only once logged-out is **confirmed**, and runs the action when signed in. Treating "unknown" as "logged out" flashes the login modal at users who are actually signed in — that is the bug this shape exists to prevent.

## Fetch failures use `error.tsx`, not try/catch

A Server Component that cannot reach the API **throws**, and the route's `error.tsx` catches it — there is no try/catch inside the page components, and adding one would break the pattern (`reset()` only exists on the boundary).

- Boundaries live at `app/error.tsx` (Discover — note Discover **is** the root route, there is no `/discover` segment), `app/search/error.tsx`, and `app/movie/[tmdbId]/error.tsx`. The root one also covers any future child segment that has no boundary of its own. None of them catch errors thrown by `app/layout.tsx` itself — that needs `global-error.tsx`.
- All three render the shared `components/shared/ErrorState.tsx`; only the heading differs, and each boundary translates its own (`errors.discoverTitle` / `searchTitle` / `movieTitle`) before passing it in. Add a heading key rather than a second copy of the markup. The boundaries sit **inside** `[locale]`, so `NextIntlClientProvider` from the layout is above them and `useTranslations` works — one at `app/` would render outside the provider and could only show untranslated text.
- **"Try again" calls the boundary's `reset()`**, which re-renders the segment and re-runs the fetch. Not `window.location.reload()`, which would discard client state and reload every other segment.
- The error is `console.error`'d in a `useEffect`; **`error.message` is never rendered** — it can carry internal hostnames and stack detail.
- **This is not the empty state.** `discover.empty` and `SearchEmptyState` mean "the request succeeded and matched nothing"; the boundary means "we could not reach the server". Keep them distinct, or a user sees "no movies match your filter" when the API is simply down.
- Worth knowing when testing: in a production build a thrown Server Component error returns a **500 with an empty HTML shell**, and the boundary renders on the client after hydration. `curl` will not show the styled message — check it in a browser.

## Testing on a phone / LAN device

Both ends need pointing at the dev machine's LAN IP; changing only one leaves requests blocked or unroutable. Find the IP with `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).

**Mind the ports:** the **API is on 3000**, the **web app on 3001**. `FRONTEND_URLS` lists *frontend* origins (`:3001`); `API_URL` / `NEXT_PUBLIC_API_URL` point at the *API* (`:3000`). Mixing them up is the usual reason "it works on localhost but not on the phone".

1. **`apps/api/.env` — `FRONTEND_URLS`**: a comma-separated list of allowed CORS origins, e.g. `http://localhost:3001,http://192.168.1.10:3001`. Both stay valid at once, so adding the phone does not break localhost. `main.ts` passes a validation function (not a static string) to `enableCors` in development; a request with no `Origin` header (curl, health checks) is allowed, an unlisted origin gets no allow-header and the browser blocks it. **Production is unchanged and still strict**: it pins to the *first* entry only, and logs a warning if more are supplied. `FRONTEND_URL` (singular) is still read as a fallback.
2. **`apps/web/.env` — `NEXT_PUBLIC_API_URL`**: must be the LAN IP, e.g. `http://192.168.1.10:3000`. A phone cannot resolve `localhost` to your machine, and the typeahead and every auth call fetch from the **browser**, so they use this public variable rather than the server-only `API_URL`. **`NEXT_PUBLIC_*` is inlined at build time — restart the dev server after changing it**, or the old value stays compiled into the client bundle.

> **The API host must match the host the browser is on.** This is not a preference — it is what makes auth work at all. The session is a `SameSite=Lax` cookie, so a browser at `http://localhost:3001` calling an API at `http://192.168.31.53:3000` is a **cross-site** request: the cookie is never stored or sent, `/auth/me` answers 401 forever, and the whole app looks signed out — while `POST /auth/login` still returns 200 with a `Set-Cookie` header, which is exactly what makes this so hard to spot. It cost a full debugging pass once.
>
> - Working on the dev machine → `NEXT_PUBLIC_API_URL=http://localhost:3000`, browse `http://localhost:3001`.
> - Testing from a phone → `NEXT_PUBLIC_API_URL=http://<LAN-IP>:3000`, and open the frontend at `http://<LAN-IP>:3001` too — **not** `localhost`.
>
> `lib/api.ts` warns in the console (dev only) when the two hosts disagree, so the next occurrence is loud rather than silent.

`.env.example` in both apps documents the full set. `apps/web/.gitignore` negates its `.env*` rule with `!.env.example` so the template stays committable while real env files do not.

## Genres come from TMDB — never hard-code them

There is **no static genre list anywhere in this repo**, and adding one back is a regression. Genres are fetched live:

- `apps/api` proxies TMDB at **`GET /tmdb/genres`** (`src/tmdb/`), returning TMDB's array **unchanged** as `{ id: number, name: string }[]`. Don't rename or reshape those fields — `id` is exactly the value TMDB's `/discover/movie` takes as `with_genres`, so it passes straight through with no lookup table on either side. The route is public (no guard); `TmdbService` uses Node's global `fetch` (there is no HTTP-client dependency, and `@nestjs/axios` is not installed) with `TMDB_API_KEY` injected via `src/config/tmdb.config.ts` following the usual `registerAs` pattern.
- `apps/web` fetches it in `lib/api.ts` with `next: { revalidate: 86400 }` — **Next's `fetch` cache is the only caching layer**, deliberately: no Redis, no database. `app/page.tsx` (a Server Component) calls it and passes `genres` down as props; the array never lives in client state.
- The shared `Genre` type is `packages/shared-types/src/genre.ts`, used by the service return type, the Swagger response (via `GenreDto`, which `implements Genre` so drift fails to compile), and every web component.
- A movie's genre is stored as `Movie.genreId` (a TMDB numeric id) and its **name is resolved at render time** against the fetched list — never stored on the movie.
- Selection lives in the **URL**, not state: `?genre=28`. `GENRE_SEARCH_PARAM` and `parseGenreParam()` in `lib/constants/discover.ts` are shared by the page (reads) and the chips (write), so the two cannot disagree. The "All" chip (`discover.allGenres`) is not a TMDB genre — it **deletes** the param rather than writing an "all" sentinel, and `null` means "no genre filter" throughout. A non-numeric param falls back to `null`.
- **Genre names are translated by TMDB, not by our message files.** `GET /tmdb/genres?lang=tr` returns them in Turkish; they are catalogue data, so they never appear in `messages/*.json`.

## TMDB endpoints: normalise on the way out, and cache per-endpoint

`GET /tmdb/genres` and `GET /tmdb/discover` (both public, both in `src/tmdb/`) deliberately behave differently in three ways. Match the existing one when adding a third endpoint.

- **Pass through vs. normalise.** Genres are returned in TMDB's exact shape because `id` is the `with_genres` value. Discover results are **not**: `TmdbService.toMovieSummary()` is the only place TMDB's snake_case is read, expanding `poster_path` into a full `https://image.tmdb.org/t/p/w500/…` URL (**`null` stays `null`** — concatenating it yields a URL ending in `null` that 404s) and slicing `release_date` to a four-digit `releaseYear` (`null` for TMDB's `""` undated entries). Web components are typed against `MovieSummary` / `DiscoverMoviesResponse` directly — there is no adapter layer, so an API shape change fails to compile.
- **Cache lifetime is per-endpoint, and Next's `fetch` is the only cache** (no Redis, no DB). Genres: `next: { revalidate: 86400 }`. Discover: `cache: "no-store"` — results vary per filter combination and shift with TMDB popularity, so nothing is reusable.
- **Failure mode differs on purpose.** `getGenres()` degrades to `[]` (an optional filter; losing it must not take down the page or the build). `getDiscoverMovies()` **throws**, and `TmdbService.discoverMovies()` never returns an empty page on error — an empty grid reads as "no films match this filter", which is a different and misleading claim. There is no `app/error.tsx` yet, so a discover failure currently renders Next's default 500.
- `discoverMovies(params)` accepts `yearFrom` / `yearTo` / `minRating` but does not forward them yet — the chips are still stubs. Fill in the TODO there rather than changing the signature. `page` is capped at `TMDB_MAX_PAGE` (500) because TMDB 400s above it, which would otherwise surface as a bogus 503.

### Page headings use one shared scale

Every top-level screen opens with `components/shared/PageHeading.tsx` — **title 28px / weight 500 / `text-mx-fg`, description 13.5px / `text-mx-fg-faint`**, description and any trailing element on one baseline-aligned row. Render it rather than writing a fresh `<h1>`; Discover and My List had already drifted to 24px/600 and 22px/500 titles with 14px and 12px descriptions purely because each was written separately.

- `text-mx-fg-faint` is the token whose **dark** value is `#71717a` (`-subtle` is `#8b8b94` there) — pick tokens by the value they carry in the theme the design was drawn in, which for this app is dark.
- `aside` is the optional right-hand slot on the description row; Discover puts its result count there and the description takes the remaining width, so a long one wraps instead of shoving it off the edge.
- `id` is for sections that point `aria-labelledby` at the title (Discover does).

### Pages are full-bleed; scaling is mobile-first

- **No page uses a centered max-width container.** Every screen — Discover, Search, movie detail — is full-bleed with edge padding only (`px-4 sm:px-6`, plus `md:px-8` where content would otherwise touch the edge on a large screen). Content fills the available width. A `mx-auto max-w-[…]` column was tried on the detail page and explicitly rejected: the page should scale in place, not get boxed. Don't reintroduce one without asking.
- **Base classes are the mobile design; desktop is added at `md:` on top.** The detail page was built mobile-first and scaled up afterwards without touching a single base value — every size is `base md:larger` (`h-[150px] md:h-[280px]`, `text-[23px] md:text-[38px]`, `size-14 md:size-[76px]`, …). When asked to scale one breakpoint, add variants; never rewrite the base, or the other breakpoint silently regresses.
- Wrapping layouts stay fluid across breakpoints — the cast row keeps `flex-wrap` with a wider cell (`w-[76px] md:w-24`) and the details grid keeps `repeat(auto-fit, minmax(…))` with a larger minimum (`140px → md:170px`). Don't swap either for a fixed column count.
- The backdrop's Back / Watch trailer buttons are positioned against the backdrop element itself (`top-4 left-4`, `right-4 bottom-4`, scaled at `md:`), with no wrapper between. Keep it that way — the trailer button in particular must stay bottom-right, never centred, because the poster overlaps upward from the left.

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
- **Handle `null` at every render site,** and decide per layout: `MovieCard` drops the badge (it floats over artwork with nothing to align to), `MovieRow` keeps its column with a muted `—` (dropping it would shunt the action button and break alignment down the list), the typeahead drops star and number together. The rating is formatted at each render site with `format.number(value, RATING_NUMBER_FORMAT)` only after a `null` check, so there is no shared helper that could silently interpolate one.

### Search (`/search?q=…`)

- **`GET /tmdb/search` takes `q` and `page` only.** TMDB's `/search/movie` supports neither `with_genres`, `vote_average.gte` nor `sort_by` — it ranks by relevance. Genre/rating/sort params lingering in the browser URL from a Discover visit are deliberately **not** forwarded; TMDB would ignore them silently, which reads as a broken filter. The results page says "Sorted by relevance" for exactly this reason, and shows no filter bar. An empty/whitespace `q` is a **400**, never sent upstream (TMDB answers it with a 422 that would surface as a bogus 503).
- **`PaginatedMoviesResponse`** (`packages/shared-types/src/movie.ts`) is the shared envelope for discover *and* search — they differ in how results are chosen, not in what a page looks like. `DiscoverMoviesResponse` remains as a deprecated alias. This is why `/search` reuses Discover's `MovieGrid`, `MovieList`, `ViewToggle` and `Pagination` unchanged rather than growing parallel components; `Pagination` takes a `pathname` prop so it can point at `/search`.
- **`/search` redirects to `DISCOVER_HREF` when `q` is missing or blank** — there is no meaningful search page without a query. Note Discover lives at **`/`**, not `/discover`; use the `DISCOVER_HREF` constant rather than hard-coding either.
- **Typeahead debounce pattern** (`components/search/SearchTypeahead.tsx` + `hooks/use-debounced-value.ts`): the raw input stays in the component's own state so a keystroke never re-renders the navbar, and the **debounced** value — never the raw one — goes into the TanStack Query key. That is what actually collapses typing into one request; debouncing only the UI would still key a new query per keystroke, and a superseded key is abandoned automatically. `enabled` gates on the debounced length (`SEARCH_MIN_QUERY_LENGTH`). Keyboard nav only moves an index in state.
- **`NEXT_PUBLIC_API_URL` must be set in any deployed environment.** `lib/api.ts` is called from both Server Components (`API_URL`) and, via the typeahead, the **browser** — where a server-only var is `undefined`. The public variable is the one Next inlines into the client bundle.
- Poster thumbnails use `next/image`, which is why `next.config.js` allowlists `image.tmdb.org` under `images.remotePatterns`. Any new remote image host needs adding there or it will not render.

### Discover filters live in the URL

Every filter is a search param read by the Server Component, never client state — so a filtered view is linkable and paginating re-runs the server fetch. Each param gets a `*_SEARCH_PARAM` constant plus a `parse*Param()` guard in `lib/constants/discover.ts`, shared by whatever reads and whatever writes it; follow that pair when adding one.

- `?genre=<tmdbId>` — written by the chips, cleared (not set to a sentinel) by "All".
- `?page=<n>` — 1-based, **omitted for page 1** rather than written as `?page=1`. `parsePageParam()` clamps everything out of range (`0`, negatives, `abc`, `9999`) into `[1, MAX_PAGE]` **server-side**, so a hand-edited URL can never reach TMDB and error. `MAX_PAGE` (500) mirrors the API's `TMDB_MAX_PAGE`, and the pagination UI clamps `totalPages` by it too.
- `?yearFrom=<y>&yearTo=<y>` and `?minRating=<n>` — written together by the filter popovers. Both are **omitted at their defaults** (the full 1950–current span, and "Any rating"): the default is not a filter, so it stays out of the URL *and* out of the TMDB query. `app/page.tsx` checks `isFullYearRange` before forwarding — sending the full span would silently drop pre-1950 and undated releases from an unfiltered browse. `parseYearParam()` / `parseMinRatingParam()` clamp or discard anything out of range.
- `?sort=<MovieSortId>` — our own vocabulary (`popularity` | `rating` | `newest` | `oldest`), **not** TMDB's `sort_by` string. `SORT_OPTIONS` in `lib/constants/discover.ts` is the single place the two are mapped (`sortByFor()`), so the URL carries `?sort=rating` rather than leaking `vote_average.desc`, and a bookmarked link survives a change in TMDB's vocabulary. The default (`popularity`) is omitted from the URL, like every other filter default; `parseSortParam()` falls back to it for anything unrecognised.
- **Sort is a plain menu, not a draft popover.** `SortDropdown.tsx` reuses `FilterPopover` only for its trigger and open/close plumbing (overriding the panel padding with `p-1.5`) — picking an option commits and closes immediately, because there is nothing to stage. Draft state is for filters with several inputs to set before committing; a single-choice control should not make the user press Apply.
- **Filter popovers hold draft state; only "Apply" commits.** `components/discover/FilterPopover.tsx` is the shared shell (trigger chip, outside-click, Escape) — deliberately *not* the genre chip, which is a one-click toggle that commits immediately. The draft lives in each filter component and is reseeded from the applied props via `onOpenChange`, so closing by Escape or outside-click discards it with no extra bookkeeping. "Reset" clears the draft without closing or committing. Commit goes through `useApplyFilters()` (`hooks/use-filter-params.ts`), which merges into the existing params — never dropping `genre` — and always resets `page`. Outside-click listens on `mousedown`, not `click`, so dragging a slider thumb past the panel edge doesn't dismiss it. **The panel is edge-collision aware**: it hangs from the trigger's left edge, and a layout effect measures the rendered panel on open and flips it to `right-0` when that would overflow the viewport (plus a `max-w-[calc(100vw-1rem)]` clamp for a viewport narrower than the panel). The measurement is required rather than a guess because each caller sets its own width via `panelClassName`. Because every filter chip *and* My List's sort control are this one shell, fixing it here fixed all of them — My List's was the visible bug, since `ml-auto` parks it against the right edge.
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
- All copy lives in the `discover` namespace of the message files: `add` / `markWatched` for the actions, `tagListed` / `tagWatched` for the tags. Never inline these strings in a component, and add each to all three languages.
- The state tag renders through `components/discover/StatusTag.tsx`, shared by the grid card and the list row so the label/colour mapping cannot drift between views.
- The list row derives its button from `ROW_ACTIONS` in `components/discover/MovieRow.tsx`, a total map keyed by state (`satisfies Record<MovieUserState | 'none', RowAction>`, so a new state fails to compile until it has an action). Each entry holds message **keys**, not labels. Adding a state means adding an entry there, not a conditional at the call site.
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
