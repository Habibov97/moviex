# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MovieX is an npm-workspaces monorepo managed by Turborepo.

- `apps/api` — NestJS backend (the active codebase; auth, entities, migrations all live here)
- `apps/web` — Next.js frontend on port 3001. Stack: Tailwind CSS v4, shadcn/ui, TanStack Query, next-intl (en/tr/ru), lucide-react (see below). Every route lives under `app/[locale]/` — Discover (`/`), Search, movie detail and My List — and `app/[locale]/layout.tsx` is the root layout; there is no `app/layout.tsx`. It is served under **`basePath: '/moviex'`** and proxies the API at `/moviex/api/*`; routes are still written prefix-free everywhere, so read the deployment section before touching `next.config.js` or `proxy.ts`.
- `packages/shared-types` (`@moviex/shared-types`) — the contract both apps are typed against: `movie.ts`, `genre.ts`, `user-movie.ts`, `locale.ts`, the zod auth schemas in `auth.ts` and the recovery-code policy/schemas in `recovery.ts`, all re-exported from `src/index.ts` (`user.ts` is still an empty placeholder). It ships **raw TS source**, so `apps/web` lists it in `transpilePackages` and `apps/api` may only import *types* from it — see the TMDB language note for what breaks otherwise.
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

Run a single test file: `npx jest src/auth/auth.service.ts` — but note **there are currently no unit tests in this project**. `src` contains no `*.spec.ts` at all, and `test/app.e2e-spec.ts` is still the untouched Nest scaffold (`GET /` → `Hello World!`). Jest's `rootDir` is `src` and test files must match `*.spec.ts`, so a first unit test goes beside the file it covers.

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
- **Auth is cookie-based, not bearer.** The access token is delivered as an **httpOnly `access_token` cookie** set by `POST /auth/login`; it is deliberately _not_ in the response body, so frontend JavaScript never holds the raw token. `Authorization: Bearer` is no longer accepted anywhere. The cookie name and its attributes live once in `src/auth/auth.constants.ts` (`ACCESS_TOKEN_COOKIE`, `accessTokenCookieOptions()`) — login, logout and the guard all import from there, and login/logout must pass **identical** attributes or the browser won't treat clear-cookie as matching the set cookie. `main.ts` registers `cookieParser()` (without it `req.cookies` is undefined and every guarded route 401s) and credentialed CORS against `FRONTEND_URLS` — a wildcard origin is invalid with `credentials: true` and silently breaks cookies. **`sameSite` follows the environment — `none` + `secure` in production, `lax` in dev — because the deployed frontend and API are on different sites; see the cross-site cookie section for why `lax` there stores the cookie but never sends it.** See the LAN-testing section for that variable's format.
- **Route protection**: `src/auth/guards/jwt-auth.guard.ts` (`JwtAuthGuard`) is a plain `CanActivate` that reads the token from `req.cookies[ACCESS_TOKEN_COOKIE]`, verifies it via `jwt.verify` (injected `jwtConfig`) and attaches the decoded payload to `request.user` (typed via the `src/auth/types/express.d.ts` module augmentation). Pull the current user in a handler with the `@CurrentUser()` decorator (`src/auth/decorators/current-user.decorator.ts`). Protect a route with `@UseGuards(JwtAuthGuard) @ApiCookieAuth('access-token')` — the `'access-token'` name must match the scheme registered in `main.ts`'s `DocumentBuilder.addCookieAuth(..., 'access-token')`. There is no "Authorize" button to paste a token into: sign in via `POST /auth/login` from the docs page itself and, because Swagger UI is same-origin, the browser carries the cookie on every later "Try it out" call.
- **No refresh tokens, no server-side session.** The JWT has a fixed expiry (`JWT_EXPIRES_IN`) and that is the whole lifetime. `POST /auth/logout` only clears the browser's cookie — the token stays cryptographically valid until it expires, since there is no denylist. Don't add refresh-token machinery without a deliberate decision to.
- **Entities** live in `src/entity/*.entity.ts` and must be registered in the owning feature module's `TypeOrmModule.forFeature([...])` for runtime DI (`autoLoadEntities: true` picks these up for the app; the CLI's `data-source.ts` finds them independently via its own glob — the two are separate registration paths, see the migrations section above).
- **Swagger** is served at `/docs` (`main.ts`), built from a single global `DocumentBuilder` — add new tags/bearer schemes there, not per-module.
- **Global `ValidationPipe`** (`whitelist`, `transform`, `forbidNonWhitelisted`) is set once in `main.ts`; DTOs rely on `class-validator` decorators only (no per-route pipe setup needed).

## Architecture notes (`apps/web`)

- **Tailwind CSS v4** — no `tailwind.config.js`; theming is CSS-first via `@theme inline` in `app/globals.css`, which `@import "tailwindcss"` and is processed through `@tailwindcss/postcss` (`postcss.config.mjs`). Light/dark tokens (`--background`, `--primary`, `--sidebar-*`, etc.) are CSS variables on `:root` / `.dark`, not Tailwind config theme keys — add new design tokens there, not in a config file.
- **shadcn/ui** is configured via `components.json` (style `base-nova`, base color `neutral`, CSS variables on). Components are generated into `components/ui/*` with `npx shadcn@latest add <component>` and are plain source files you own/edit directly, not an npm dependency — this preset builds on **Base UI** (`@base-ui/react`), not Radix. Import alias `@/*` maps to `apps/web/*` (`tsconfig.json`); use `@/components`, `@/lib`, `@/hooks` per `components.json`'s aliases. The `cn()` class-merging helper is in `lib/utils.ts` (`clsx` + `tailwind-merge`).
- **MovieX design tokens — never hard-code a colour in a component.** Every product surface/text colour is a `--mx-*` CSS variable declared twice in `app/globals.css`: light values on `:root`, dark overrides in `.dark` (values-only overrides — tokens identical in both themes, like `--mx-accent`, live only on `:root` and are inherited). They are exposed to Tailwind through `@theme inline` as `--color-mx-*`, so components use utilities: `bg-mx-nav`, `bg-mx-card`, `bg-mx-field` (inset field, e.g. modal inputs), `bg-mx-field-raised` (raised field, e.g. the navbar search), `border-mx-border` / `border-mx-border-subtle`, `text-mx-fg` / `-muted` / `-subtle` / `-faint`, `bg-mx-accent` / `hover:bg-mx-accent-hover` / `text-mx-on-accent`, `text-mx-success`, `bg-mx-backdrop`, the `mx-avatar-*` set, and `font-mx` (the system-sans stack the designs use). Colours picked in JS (e.g. the password-strength meter) pass `var(--mx-strength-weak|medium|strong)` rather than hex, so they theme too. A new component that hard-codes hex will not respond to the theme switcher — add a token instead.
- **The brand mark is `components/shared/LogoMark.tsx`, and it is the only place it is drawn.** Two triangles meeting mid-tile as an abstract "X", on a dark rounded square. It replaced a plain accent square that had been inlined *twice* — once in the navbar's `BrandMark`, once in `LoginRegisterModal` — which is exactly the drift this note exists to prevent: **render `LogoMark`, never paste the SVG or approximate the tile with a styled `<div>`.** `BrandMark` composes it with the wordmark for the horizontal lockup (navbar); a surface wanting just the tile renders `LogoMark` directly, as the auth modal does because its wordmark is 15px against the navbar's 18px.
  - Its colours — `--mx-logo-surface` (`#17171b`) and `--mx-accent-deep` (`#a13230`, the darker right-hand triangle) — sit on `:root` with **no `.dark` override**, like `--mx-accent`. A brand mark is the same colour in both themes, and the dark tile is part of the logo, not a surface that should follow the page. `--mx-accent-deep` is a *shading* value, not an interaction state: don't substitute it for `--mx-accent-hover` (`#c93f3e`) or vice versa.
  - **The icon files in `app/` are generated, not hand-drawn**: `npm exec -- node scripts/generate-icons.mjs` writes `icon.svg`, `favicon.ico` (16/32/48) and `apple-icon.png` (180). They are picked up by Next's App Router file conventions, so there is no `icons` entry in `generateMetadata` and none should be added. That script restates the geometry and the colours as literal hex **by necessity** — a favicon renders outside the document, where `var(--mx-*)` resolves to nothing — so it is the one sanctioned copy. Change the artwork in `LogoMark.tsx` and re-run the script, or the two silently diverge.
  - There is no `manifest.json`, so there are no PWA icon exports. If one is ever added, generate its 192/512 PNGs from the same script rather than starting a third copy of the artwork.
- **Dark/light switching** is `next-themes` (`ThemeProvider` in `app/[locale]/providers.tsx`, `attribute="class"` → `.dark` on `<html>`, `defaultTheme="dark"`), with `suppressHydrationWarning` on `<html>` in `layout.tsx`. `components/layout/ThemeToggle.tsx` is the switcher; it decides which icon shows with the `dark:` variant rather than a `mounted` effect, which keeps it SSR-safe with no hydration mismatch — copy that pattern instead of gating render on `useEffect`.
- **Base-layer resets**: anything global in `globals.css` must sit inside `@layer base`. Unlayered CSS outranks Tailwind's utility layer, so a bare `* { padding: 0; margin: 0 }` silently kills every `p-*`/`m-*` utility in the app (this bit us once already).
- **lucide-react** is `components.json`'s configured `iconLibrary`, but the auth/nav components use **`@tabler/icons-react`** (outline), which is what the design references specify.
- **TanStack Query** is wired up in `app/[locale]/providers.tsx` (`QueryClientProvider`, client created inside `useState` so SSR requests don't share a cache). Server-state calls belong in hooks like `hooks/use-auth.ts` (`useLoginMutation` / `useSignupMutation`), not inline in components. Note it only covers async/server state — DOM concerns (scroll lock, key listeners, focus) are still plain effects.
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
- Key parity is checkable: flatten all three files and diff the key sets. They must be identical — 212 keys as of writing.

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

### Navigation only links to routes that exist — and the footer links to nothing at all

`NAV_LINKS` in `lib/constants/navigation.ts` is the **single list of in-app destinations, and the navbar is the only thing that renders it.** The whole app is four routes — `/`, `/my-list`, `/search`, `/movie/[tmdbId]` — and only the first two are linkable without context, which is exactly what the array holds. Discover is referenced there as `DISCOVER_HREF` rather than a literal `'/'`, since that constant is already the shared answer for "where is Discover" (`/search`'s blank-query redirect uses it too); `/my-list` has no such constant and is written once, in `NAV_LINKS`.

**When adding, renaming or removing a route, check it against `NAV_LINKS`. Don't add a link for a page that does not exist yet** — a link to a planned route is a 404 with a TODO beside it, and the TODO is what gets forgotten. Nothing fails loudly here: a dead `<Link>` only breaks when someone clicks it.

That is not hypothetical. The footer originally kept its own `FOOTER_COLUMNS` and drifted badly, advertising Statistics, Privacy, Terms and Contact under two column headings — **none of which were ever built**, all four 404ing at the Turkish placeholder paths (`/istatistikler`, `/gizlilik`, `/sartlar`, `/iletisim`) from the original mockup.

**The footer is now three lines of plain text in one row, and contains no links whatsoever**: `author` · `copyright` · `attribution`, left, centre, right, flex-wrapping to centred on narrow screens. No brand mark, no columns, no divider, nothing clickable. That is the durable fix for the drift above — a footer with no links cannot go stale when a route is renamed, and the two routes worth linking to are in the navbar already. Its message namespace is exactly those three keys; if a fourth is being added, that is a change of direction worth questioning.

- **The TMDB attribution stays regardless of anything else that gets trimmed** — crediting them is a condition of using their data, not filler.
- **Don't pad it back out** with sections to fill space. It is sized to how little there is to say.
- `--mx-footer` is its own token (`#08080a` dark / `#fafafa` light) because no existing token carried that value — a hair behind `--mx-bg`, so it reads as recessed rather than as another raised bar like the navbar. A literal hex would have left it near-black in the light theme.
- `BrandMark` lost its `size` prop with this change: the `lg` variant existed only for the footer's old brand block, leaving the navbar as the sole caller at one scale.
- **Route is `/{locale}/my-list`** (`/my-list` in code — the `Link` from `@/i18n/navigation` adds the prefix). The navbar and footer links were updated from the old Turkish `/listem` placeholder, which never had a page behind it.
- **`/my-list` is not reachable signed out — it redirects to Discover, and the explanation travels with the user.** `MyListView` reads `useCurrentUser` and branches into **three** states, in this order:
  1. `isAuthLoading` → `MyListSkeleton`, a pulsing mirror of the real layout. Auth is *unknown* here, so neither other branch can be trusted yet; acting on it is what would bounce someone who is in fact logged in.
  2. confirmed `!isSignedIn` → an effect calls `requestAuthNotice()` and `router.replace(DISCOVER_HREF)`. The skeleton keeps rendering for the frame or two until it commits — visibly not content, so it cannot be mistaken for an empty list.
  3. signed in → the list.
- **This replaced an in-page `SignInRequired` component, which is deleted rather than kept as a fallback.** A page whose only content is "you may not have this" is still a page the visitor landed on. There is no second layer here now: the route redirects, full stop.
- **It is *not* a return to the old silent `router.replace`, and the difference is the whole point.** What made that read as a broken link was arriving somewhere else with no explanation. The notice is exactly that missing explanation — so don't "simplify" it away and leave the bare redirect.

### `AuthRequiredNotice`: one notice, two triggers, one handoff

`components/auth/AuthRequiredNotice.tsx` is a small "you need to be signed in" dialog. **It is not the login form** — it sits in front of `LoginRegisterModal`, and only its "Sign in" button summons the real thing. Asking someone who clicked "My list" out of curiosity to face a full auth form is a bigger jump than the click implied.

Two triggers, and they must stay identical, which is why there is one component and one hook rather than two implementations:

1. **The navbar's gated "My list" click**, while confirmed signed out.
2. **Arriving on Discover after `/my-list` bounced them.**

- **`useAuthRequiredNotice({ title, message })` owns the handoff**, returning `show()` and an `element` for the caller to drop into its own tree — the same shape `useLibraryActions` uses for `authModal`, because a hook cannot render. Three stages, one surface mounted at a time: `idle` → `notice` → `modal`. Both call sites pass `myList.signInTitle` / `myList.signInBody`, the same two strings the deleted `SignInRequired` used, so no new copy was invented and none was orphaned.
- Its callbacks are `useCallback`-stable **deliberately**: the notice binds Escape and the body scroll lock in an effect keyed on `onDismiss`, and the navbar re-renders on every route change, so fresh arrows would tear both down and rebuild them constantly.
- **Freely dismissible** — close button, backdrop, Escape. The `saveCode` view is this app's one non-dismissible dialog because losing that code costs the account; nothing is lost here.
- **No new visual design**: `LoginRegisterModal`'s shell at `max-w-[320px]`, the same `bg-mx-backdrop`, the same `rounded-[14px]` `bg-mx-card` panel and accent button, and the 52px lock badge `SignInRequired` used.

### The one-shot flag: `lib/auth-notice.ts`

`requestAuthNotice()` before the redirect, `consumeAuthNotice()` on Discover's mount — **read and deleted in the same call**, so a refresh, a bookmark or any later ordinary visit to Discover is silent. Clearing on read rather than on dismiss also makes a double invocation (React's development double-effect) harmless: the second call already sees nothing.

**`sessionStorage`, not a query param.** A param would sit in the URL, be copied into anything the user shares, and need a second `router.replace` to clear — history churn to undo something the app itself put there. The redirect is a client-side navigation, so `sessionStorage` survives it intact, and per-tab is the right scope for a flag about one navigation. Every access is wrapped in `try`/`catch`: `sessionStorage` throws outright in some privacy modes, and a missing explanation is cosmetic, never worth a crash.

Consumed in `DiscoverSection` — the Discover screen's existing client boundary — in a mount-only effect. The empty dependency list is the point: this is about *that* arrival, not about anything that changes afterwards.

### The navbar's gated link

- **The navbar and the route are not redundant, they cover different ways in.** A signed-out *click* is intercepted and shows the notice; reaching `/my-list` any other way — typed, bookmarked, back/forward, middle-clicked, JS not yet hydrated — hits the route, which redirects and shows the same notice on Discover. Either path ends in the same place with the same explanation.
- **It intercepts the click with `preventDefault()` and leaves the `href` alone**, which is what keeps the anchor a real link: copyable, middle-clickable, correct with JS off.
- **Three-way, in this order:** only a **confirmed** `isSignedIn` lets the click through; confirmed signed-out opens the notice; while `/auth/me` is in flight the click is swallowed and the link is simply inert. Treating that unknown moment as signed-out would put a "sign in" notice in front of someone who is signed in.
- **It reads `useCurrentUser` directly rather than going through `useLibraryActions().requireAuth`**, and that is not a duplicated check — it is a different policy. `requireAuth` hard-codes the *full modal* as its signed-out branch; the navbar's branch is the notice. Same shape, different surface.
- **Which links are gated lives in `NAV_LINKS`** as `requiresAuth: true`, not as an `href === '/my-list'` test in the component — same reason the hrefs themselves live there. The mobile sheet closes on a gated tap only when something visibly happened (navigation or the notice); during the inert loading moment it stays open, since closing it would read as a dead link.
- **The link is still shown to signed-out visitors, deliberately.** Hiding it would remove the clearest reason this app has to offer for creating an account — the same argument that keeps the detail page's action buttons enabled and full-colour rather than disabled.
- **Signing in from the notice needs no redirect or reload.** The modal's success path invalidates `['auth','me']`, `useCurrentUser` re-reads, and every auth-dependent surface updates — including the navbar link, which becomes an ordinary link again.

- **One combined query, filtered client-side.** `GET /user-movies` with **no** status filter, under `['user-movies','list','all']`. Both tabs, all three stats and the sort derive from that one array. Per-status requests would mean two caches to invalidate and a stats bar that can disagree with the tab above it — and every mutation already invalidates the `['user-movies']` root, so this updates for free.
- **Sorting is client-side** for the same reason: the whole list is already in memory. Note the "Rating" sort option is a **stub** — `user_movies` stores no rating (there is no rating feature) so it falls back to recency rather than appearing broken.
- **Saved entries are snapshots, and snapshots are not translated.** `title` / `posterUrl` were stored in whatever language the user was browsing when they saved the film, and they come from our own database, not TMDB. Switching language translates the page's chrome, not the cards. Re-saving refreshes them (every `POST` writes the snapshot again). Accepted trade-off — the alternative is a TMDB call per row on every visit.
- **The "top genre" stat is the deliberate exception to that, and the reason is cost, not consistency.** It stores a genre **id** and resolves the name at render time, so it *does* follow the language switcher. Read the two rules together: snapshot what would be expensive to refresh, store an id for what is free to resolve. Keeping the genre name current costs one `Map.get` against a list the page already fetched; keeping a title or poster current would cost a TMDB call **per saved row, on every visit**. Same principle, opposite answer.
  - **`primaryGenreId`** (`int`, nullable) is the column: TMDB's genre id for the movie's first genre, alongside `title`/`posterUrl`/`releaseYear`. Enough to tally a top genre across both tabs without a relation table or a TMDB call.
  - `app/[locale]/my-list/page.tsx` fetches `getGenres(locale)` and passes it to `MyListView` as a prop — the same Server-Component-fetches-and-passes-down pattern Discover and Search use, and free: `getGenres` is `revalidate: 86400` keyed per locale, so all three pages share one cached response per language.
  - **`—` covers three cases, not one:** nothing saved, nothing saved carrying a genre id, and a winning id absent from the fetched genre list. The last should not happen (the ids come from the same TMDB catalogue), but a raw number in a stat card would be worse than the placeholder.
  - **It used to store the resolved `primaryGenre` *name*, which was a bug**: the word froze in whatever language the saver was browsing, so a film saved in Russian still read "Мультфильм" after switching the site to English. Don't reintroduce a name column here.
  - **That column still exists and is unread.** Kept so the fix needed no destructive migration; `AddPrimaryGenreId1787594400000` only adds. It is marked `@deprecated` in the entity, the DTOs and `@moviex/shared-types`, and the DTO still *accepts* it purely because the global `forbidNonWhitelisted` would 400 an older client that still sends it. Nothing reads it for display — check that before wiring it to anything.
  - **Rows saved before the column have no id and simply do not count**, the same way an absent rating is not treated as a zero elsewhere. There is deliberately **no backfill**: the old values are in one of three languages per row, so recovering an id would mean fuzzy-matching names across three locales' genre lists. Every `POST` rewrites the row, so ordinary use repairs them.
  - `useLibraryActions()` **no longer takes a `genres` option.** It only existed to resolve that name before saving; saving now needs no genre list at all, since `MovieSummary` already carries `genreIds` (the detail page passes `movie.genres[0].id`).
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
| `GET /user-movies?status=` | The caller's list, newest-updated first. Backs the My List page, which calls it **without** a status and filters client-side. |
| `GET /user-movies/status?tmdbIds=1,2,3` | **Batch lookup** — see below. |

- **Snapshot fields are denormalised on purpose.** `title` / `posterUrl` / `releaseYear` are stored on the row, sent by the client from whatever card it acted on. The client already holds them, so saving costs no TMDB round trip, and "My List" renders from our own database instead of one TMDB call per saved row. Accepted trade-off: a retitled or re-postered film keeps its values until a later write refreshes them (every `POST` does).
- **`primaryGenreId` is *not* one of those snapshots** — it is an id precisely so its display name is resolved fresh, in the reader's language. See the top-genre notes in the My List section above for why the two rules differ. The legacy `primaryGenre` name column beside it is deprecated and unread.
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

### The second occurrence: badges kept showing the previous account

Same symptom, reported again later — log out, log in as someone else in the same tab with no refresh, and the "In list" / "Watched" badges on Discover and Search cards and the detail page's action buttons still showed the *previous* user's saved state. **The earlier fix had not generalised**, but not for the reason it looked like: `useMovieStatuses` was already keyed with `userMoviesKey(user?.sub)`, correctly. Two different faults were behind it, and both are worth knowing because neither is visible by reading a query key.

**1. `removeQueries()` does not clear what a mounted observer is already rendering, and it deletes the query `invalidateQueries` would later need to match.** Logout's unfiltered `queryClient.removeQueries()` destroyed **`['auth','me']` along with everything else**. The mounted `useCurrentUser` observer kept returning the departing user — removal empties the cache, it does not push `undefined` into live observers — and, with the entry gone from the cache, nothing re-created it. So `/auth/me` was never re-requested. `user.sub` stayed the old id, every key built from `userMoviesKey(user?.sub)` stayed pointed at that account, and the badges stayed. The next login's `invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })` then matched **nothing** — invalidation only reaches queries the cache still holds — so signing in as someone else did not repair it either. Only a remount did, which is exactly why My List looked fine: you *navigate* to it, so its components mount fresh and re-create their queries.

  Measured against `query-core` rather than reasoned about: across a full logout → login cycle the `/auth/me` fetch count stayed at **1**. With the fix it goes 1 → 2 → 3.

  **Logout therefore exempts the auth key from the removal**, then `setQueryData(CURRENT_USER_QUERY_KEY, null)` (the cookie is already gone — signed-out is true now, and it blanks the UI in the same tick) and only then invalidates to re-verify. Everything else is still removed. **Do not "simplify" that back to a bare `removeQueries()`** — the exemption is the fix.

**2. `enabled: false` does not blank a query's last result.** Disabling stops fetching; it does not discard what already resolved. A component reading `query.data` renders the previous account's statuses for as long as it stays mounted. `useMovieStatuses` now gates its return on `isSignedIn` explicitly, so signed-out means no badge regardless of what is sitting in the observer. `useUserMovies` needs no such gate only because its one consumer, `MyListView`, already branches on `isAuthLoading` / `!isSignedIn` before it reads `data` — if a second consumer appears, it owes the same check.

**So the rule has three parts now, not one.** A new user-scoped hook is not safe merely because its key carries the user id:

1. Key it with `userMoviesKey(...)`.
2. **Gate the rendered value on `isSignedIn`**, not just the query's `enabled`.
3. Check that whatever clears the cache on sign-out leaves `['auth','me']` alive and actually refetching — every per-user key is derived from it, so freezing that one query silently freezes all of them.

Login's `useSessionEstablished` needs no change: `removeQueries({ queryKey: USER_MOVIES_KEY })` is a prefix match, so it reaches every `['user-movies', <id>, …]` entry including the `status` lookups, and its `invalidateQueries` on the auth key now matches because logout stopped destroying it.

**And the general lesson: don't assume a documented fix covered a hook it was not written against.** Both times this bug shipped, the reasoning was sound for the query someone had in front of them and simply never ran against the others.
- The unique constraint is `(userId, tmdbId)`; the index is `(userId, status)`, which is exactly what the batch lookup and the status-filtered list query on.
- **"Mark as watched" uses POST, not PATCH.** It is reachable from a card for a movie that may not be saved yet, and PATCH 404s on a missing entry; POST covers both cases. PATCH is only used for "Move back to list", where the entry is known to exist.

## Auth submit: endpoints and field mapping

`LoginRegisterModal` submits through `hooks/use-auth.ts`. Several details are easy to get wrong because the brief-level names do not match the API:

- **The route is `POST /auth/signup`, not `/auth/register`.**
- **The register form's field is labelled "Username", and the value is `userName` everywhere except the client-side schema.** The chain is: `users.userName` column → `RegisterDto.userName` → wire body `userName` — but the zod `registerSchema` and the form's own state call it `name`, with `use-auth.ts` doing the mapping. That seam is deliberate and documented; **don't rename either side to "fix" it**, the label was the only thing that was ever wrong.
- **`RegisterDto` wants `userName`, not `name`**, and the API's global `forbidNonWhitelisted` means any extra property is a **400**. So the signup body is exactly `{ userName, email, password }` — `confirmPassword` is client-side only — and the login body is `{ email, password, rememberMe? }`. **`rememberMe` does now go on the wire**: `LoginDto` declares it as optional, and it is what selects the session length (see below). It used to be stripped client-side precisely because the DTO did not declare it and `forbidNonWhitelisted` answered `400 "property rememberMe should not exist"` — which is still what any *other* stray property gets.
- **A duplicate account returns `404` ("User already exists"), not `409`.** Match on the status the backend actually returns.
- `NAME_MIN_LENGTH` in `@moviex/shared-types` is **4**, aligned with `RegisterDto`'s `@MinLength(4)`. If those drift, a name passes client validation and then 400s server-side.

### Password rules: one policy, two enforcement copies, and never at login

A **new** password needs 8+ characters, one uppercase letter and one special character. `passwordSchema` in `@moviex/shared-types` is the source of truth for what the rules *are*, and exports `PASSWORD_UPPERCASE_PATTERN` / `PASSWORD_SPECIAL_PATTERN` so the strength meter tests the very same expressions the validator does instead of keeping its own idea of "special character".

- **`apps/api` restates the rules by hand in `RegisterDto`, and cannot do otherwise.** `@moviex/shared-types` ships raw `.ts`; Node cannot parse it at runtime (`node dist/main` throws on the type syntax — verified, it is not just the barrel's extensionless re-exports), so the API may import **types** from that package but never **values**. The DTO carries a comment saying so. Edit the two together. They had already drifted before anyone noticed: the schema said 8 while the DTO said 6, so any non-browser caller could register with a password the UI would have refused.
- **Never apply the new-password policy at login.** `loginSchema` uses `loginPasswordSchema` — presence only — precisely because every account created before a rule existed would otherwise fail validation *in the browser* and be locked out of its own login form, with no request ever sent. `LoginDto` keeps its original `@MinLength(6)` for the same reason. Whether a password is correct is the service's answer, not the form's. This split is the whole reason `passwordSchema` and `loginPasswordSchema` are separate exports; do not collapse them.
- **The strength meter scores *everything*, mandatory criteria included, and is deliberately not gated on `passwordSchema`.** Six criteria, one point each — length ≥ 8, length ≥ 12, uppercase, lowercase, digit, special character — bucketed 0–2 weak / 3–4 medium / 5–6 strong. The two boundaries are named constants (`MEDIUM_MIN_POINTS`, `STRONG_MIN_POINTS`) next to `STRONG_PASSWORD_LENGTH` in `LoginRegisterModal.tsx`, so retuning is a one-line change; raising `STRONG_MIN_POINTS` to 6 makes "strong" mean 12+ characters carrying all four character classes.
  - **This reversed an earlier decision, and the reversal matters.** The meter used to return "weak" for anything `passwordSchema` rejected and then score only the *optional* criteria beyond it, reasoning that crediting a password for something it could not have omitted would rate every valid password strong. Correct in isolation, wrong in practice: the bar sat flat at weak however long or varied the password became, then usually jumped straight past medium to strong the instant the last mandatory rule (a special character) was met — because a password that far along already satisfied most of the bonus criteria. It communicated nothing during the stretch of typing where feedback is worth having. **Don't reinstate the schema gate**; it is what produced that bug.
  - **The meter's job is progressive feedback, not a verdict.** "Strong" is earned by a high running total rather than by a special zero-credit rule for the required criteria. A consequence to expect rather than fix: a perfectly valid password can read "medium" (`PASSWOR!` scores 3), because the meter answers "how good is this?" while the schema answers "does it meet the bar?" — conflating those two questions is the original bug.
  - **Display only.** Submit-blocking validation, the error messages and `passwordSchema` itself are untouched. The meter still imports `PASSWORD_MIN_LENGTH` / `PASSWORD_UPPERCASE_PATTERN` / `PASSWORD_SPECIAL_PATTERN` from `@moviex/shared-types` rather than restating them, so it and the validator cannot disagree about what a symbol is. Lowercase and digit are local patterns purely because they are meter-only heuristics with no rule in the schema to import.
- **Every key `AUTH_VALIDATION_KEYS` and `RECOVERY_VALIDATION_KEYS` can emit needs copy in all three message files.** Worth asserting when adding a rule: flatten `auth.validation` per locale and diff it against the union of those two arrays — a missing key renders an error placeholder rather than a message, and an orphan is copy for a rule that no longer exists.

### "Remember me": two session lengths, and why they cannot drift

The checkbox is wired to the real session. There are **two** durations and nothing else changes between them:

| Checkbox | Duration | Config key | Env var |
|---|---|---|---|
| Unticked (or `rememberMe` omitted) | **`1d`** | `jwt.expiresIn` | `JWT_EXPIRES_IN` |
| Ticked | **`30d`** | `jwt.rememberExpiresIn` | `JWT_REMEMBER_EXPIRES_IN` (defaults to `30d`) |

- **No refresh tokens are involved, by design.** This app has none and no server-side session, so the signed lifetime *is* the session — which is why "remember me" is a change to one number rather than a new mechanism. Don't add refresh-token machinery to implement a longer session.
- **The JWT expiry and the cookie's `maxAge` are the same value, structurally, not by convention.** `AuthService.issueSession()` picks one duration, signs with it, then reads the lifetime back off the token's own claims — `expiresInMs = (exp - iat) * 1000` — and the controller sets that as `maxAge`. The duration string is never parsed a second time, so there is no second place to update and no way for the cookie to outlive the token inside it (or expire before it). **Retune the values in `jwt.config.ts` and both move together** — there is one duration string, read once. (This used to claim a test asserted it on both branches; there is no such test, and no unit tests in the API at all — see the commands section.)
- **`rememberMe` is not a claim.** It selects the expiry and is then discarded — the token payload stays exactly `{ sub, email, iat, exp }`. Nothing downstream needs to know which kind of session it is.
- **Omitted means `false`, on both sides.** `LoginDto` marks it `@IsOptional()` and `loginSchema` is `z.boolean().optional().default(false)`, so an existing caller that sends nothing keeps the short session it always had.
- **Signup always issues the short session.** `POST /auth/signup` signs the new user in, but "remember me" is a choice made on the *login* form and the register form never presents it. Adding the field to `RegisterDto` would mean inventing a preference the user was never asked for; the shorter default is the honest one, and their next sign-in is where they choose.

**Register *does* sign the user in, and that is a deliberate reversal** — see the account-recovery section below. `/auth/signup` sets the session cookie itself and returns the one-time recovery code; the modal shows that code and then closes into the signed-in app. It used to set no cookie at all, because an unverified address could not hold a session. With email verification gone there is nothing left to wait for, and the modal does **not** chain into a second `/auth/login` call — it never did, and reintroducing one would ask for a password typed seconds earlier and prove nothing.

Only `AuthError` messages (curated in `use-auth.ts`) are rendered; anything else falls back to generic copy, so raw upstream text and stack detail never reach the UI. `useLoginMutation` invalidates `['auth','me']` on success — that, not a reload, is what flips the navbar and the gated buttons.

## Account recovery: a one-time code, and no other way back in

**There is no email in this application.** The emailed-OTP system that used to gate signup and drive password reset was removed wholesale, because the deployment host blocks outbound SMTP at the network level — see the platform post-mortem at the end of this section, kept because the *lesson* generalises even though the code it describes is gone. No code this app generates could ever reach a user, so the flow was replaced rather than repaired.

What replaced it: **a 6-character recovery code, shown exactly once at signup, which the user saves themselves.** It is the only thing that can authorise a password reset.

**State the consequence plainly, because it is the design and not a gap to fix later: a user who loses both their password and their recovery code has permanently lost the account.** There is no reset-by-email, no support path, and no way to regenerate the code — the server stores a bcrypt hash and nothing else. The UI says this in as many words (`auth.saveCodeWarning`), and any change here has to keep saying it.

### The code itself

| | Value | Where |
|---|---|---|
| Length | **6 characters** | `RECOVERY_CODE_LENGTH` |
| Alphabet | **23 uppercase letters** — A–Z minus `I`, `O`, `L` | `RECOVERY_CODE_ALPHABET` |
| Hashing | bcrypt, **the same salt rounds as the password** | `AuthService.saltRounds` |
| Expiry | **none** | — |
| Reset-token TTL | 10 minutes | `RESET_TOKEN_TTL_SECONDS` |

- **`I`, `O` and `L` are excluded because this is transcribed by hand.** `I`/`1`, `O`/`0` and `l`/`1` are the classic misreadings, and a wrong character is indistinguishable from a wrong code. Digits are left out entirely so no `0` can be confused with an `O`. That costs ~0.4 bits per character against a full 26-letter alphabet, which is the right trade: a code that is mistyped is not more secure, it is unusable.
- **Generated with `randomInt` from `node:crypto`, never `Math.random`.** It is a credential that never expires, and a seeded PRNG's next draw is predictable from its previous ones — one leaked code would leak its neighbours.
- **Hashed exactly like a password**, because it *is* a second password: it alone is enough to take the account. Reusing `saltRounds` rather than introducing a second constant is deliberate; two knobs would eventually disagree.
- **The alphabet and length exist in three places** — `@moviex/shared-types`, `apps/api/src/auth/recovery.constants.ts`, and the regex in `VerifyRecoveryCodeDto`. The usual constraint: the API may import *types* from that package but never values. **Edit all three together**; a mismatch means the server generates a code its own validator rejects.

### No expiry means rate limiting is the defence, not a supplement

23^6 ≈ 1.5×10^8 possibilities. Unlike the OTP it replaced, a recovery code has **no lifetime and no per-code attempt ceiling** — so `POST /auth/verify-recovery-code` is limited to **5 attempts per minute per IP** (`RECOVERY_CODE_LIMIT`), the same budget a password gets at login. That puts a single-address exhaustive search at roughly 58 years.

**This is the only thing between an attacker and an unlimited guessing run.** Loosening that limit is a security decision, not a tuning one. The bcrypt hash at rest is the second layer, for the case where the limit is bypassed by distributing across addresses.

### Endpoints

| Route | Notes |
|---|---|
| `POST /auth/signup` | Creates the account, **signs the user in** (sets the cookie), and returns the plaintext recovery code. The only time it is ever retrievable. |
| `POST /auth/verify-recovery-code` | `{ email, recoveryCode }` → a short-lived reset token. **No cookie, no session.** |
| `POST /auth/reset-password` | `{ resetToken, newPassword }`. **Still no session** — go and sign in. |

**Signup now signs the user in, which is a deliberate reversal.** It used to set no cookie at all, because the address had not been proven and holding the password was explicitly not sufficient. With email gone there is nothing left to wait for, and a separate login step immediately afterwards would ask for the password typed seconds earlier and prove nothing this request has not already established. `AuthService.issueSession()` is still the single place a session is created — `login` and `signUp` both end there.

**Verifying the recovery code does *not* sign anyone in**, and that asymmetry is the point. Possessing the code proves the user can authorise a reset; it does not prove intent to sign in, and an abandoned reset must not leave someone holding a session for an account whose password they still do not know.

### Non-disclosure at `verify-recovery-code`

Three different failures answer **identically** (`400`, `code: "RECOVERY_CODE_INVALID"`):

- no account for that address,
- an account with no `recoveryCodeHash`,
- a genuine mismatch.

Distinguishing any of them makes the endpoint an account oracle, and the user's next action is the same in all three cases. Note this is stricter than `signUp`, which still answers "User already exists" — enumeration is not closed in this app, but reset is the endpoint an attacker actually wants an oracle on. **Don't "make it consistent" by loosening this one.**

The null-hash branch is a **defensive** check, not a user-facing case: it also stops `bcrypt.compare` throwing on a null digest. Pre-migration accounts are being deleted manually rather than migrated.

**Timing is deliberately not equalised** with a dummy-hash comparison. The 5/minute limit is the defence that matters for a code with no expiry; a timing side-channel measured through it is not the weak link, and equalising would add bcrypt's cost to every request for an unknown address.

### The reset token: a JWT that is deliberately not a session

Unchanged from the flow this replaced — only what must be proven before it is issued changed.

Signed with the same `JWT_SECRET`, which is exactly why the `purpose: 'password_reset'` claim is load-bearing rather than decorative. **Without it, any token signed with that secret would be accepted — including the session token in every signed-in user's cookie**, turning "I am signed in" into "I may change this password without knowing the current one" and a stolen cookie into a permanent takeover.

- Payload is exactly `{ sub, purpose, iat, exp }` — no email, nothing session-shaped.
- **10 minutes** (`RESET_TOKEN_TTL_SECONDS`).
- **Returned in the response body, not as a cookie.** It is a transient one-time credential the client holds across two consecutive requests; the short expiry is most of what makes a JS-readable token acceptable. The client keeps it in `ResetPasswordForm`'s state and **never** in `localStorage`, `sessionStorage`, a cookie or the URL — unmounting the modal disposes of it, which is only true while both stages share one mount.
- Bad signature, expired, wrong purpose and not-a-JWT all collapse to one `RESET_TOKEN_INVALID`. They mean the same thing to the user; distinguishing them describes the token back to whoever is probing it.

### The recovery code is not rotated by a password reset

`resetPassword` changes the password and nothing else. Rotating the code there would replace it with a value the user has never seen and lock them out of the *next* reset — the exact failure this system exists to avoid. Someone reaching that point already proved possession of the code, so using it has not compromised it.

### Accepted trade-off: other sessions survive a password reset

Unchanged, and worth restating. This app has no refresh tokens, no server-side session and no denylist, so an already-issued token stays cryptographically valid until its own expiry — the identical limitation logout has. A reset locks an attacker out of *future* sign-ins but not an existing session, for up to `JWT_EXPIRES_IN` (or 30 days on a "remember me" token). Closing it needs a real revocation mechanism — a `passwordChangedAt` column the guard compares each token's `iat` against would do it — and is a deliberate change to make, not something to bolt onto `resetPassword`.

### The migration drops the verification columns and does not backfill

`1787680000000-ReplaceOtpWithRecoveryCode` drops `otpCode`, `otpExpiresAt`, `otpAttempts`, `otpLastSentAt`, `otpPurpose` and **`isEmailVerified`**, and adds nullable `recoveryCodeHash`.

- **`isEmailVerified` had to go, not just be ignored.** It was the login gate, and the only thing that could ever flip it was an emailed code. Keeping it would leave every new account locked out by a gate with no key.
- **There is deliberately no backfill, and this is the opposite choice from `AddEmailVerification`**, which backfilled `isEmailVerified = true` precisely so existing accounts were not locked out. The difference is that a recovery code cannot be invented on a user's behalf — the whole security property is that exactly one person has ever seen it, and a value generated by a migration is one nobody has. **Pre-migration accounts are being deleted manually rather than migrated**; they cannot reset a password and there is no honest way to give them one.
- `down()` restores the columns with `isEmailVerified` defaulted to **`true`** (matching the old backfill), so a rollback does not lock everyone out of a gate this migration removed. The OTP values themselves are gone for good.

### The modal: four views, one of which cannot be dismissed

`AuthMode` is `login | register | saveCode | reset`. Same tokens, no new design.

- **`saveCode` is the one modal in this app that ignores Escape and backdrop clicks.** The cost of leaving it by accident is not "reopen it later", it is the account — so a checkbox gates the Continue button and there is no other way out. `canDismiss` drives both the backdrop handler and the Escape listener; the listener reads it through `canDismissRef` because it is bound once per open and re-binding it on every view change would also re-run the scroll lock beside it.
- **Acknowledging just closes the modal.** Signup already established the session and `useSignupMutation` already ran the same cache hygiene login does, so branch-3 auth state is live before this view even renders. There is no separate login step and nothing left to fail.
- **`ResetPasswordForm` is one component for two stages** (`code`, then `password`) specifically because the reset token lives between them, and unmounting is what disposes of it. It reports its stage upward so the heading can follow; the token never leaves.
- **The reset flow is two steps where the emailed one needed three.** The middle step existed only because email delivery is asynchronous — request a code, wait, then verify. A code the user already has needs no such round trip, so the address and the code are collected in one form. `ForgotPasswordForm` is gone.
- **`RecoveryCodeInput` is the old `OtpCodeInput`, adapted rather than rewritten.** Everything subtle in it was a separate small fix — select-on-focus, backspace stepping back, paste filling forward — and a fresh implementation would have to rediscover all of them. What changed: six boxes instead of four, letters instead of digits, upper-cased as typed, and anything outside the alphabet dropped rather than shown and then rejected. It is still controlled by the character **array**, never a joined string. The `ref` handle is gone — it existed only so a resend could refocus box one, and nothing is resent any more.
- **No auto-submit on the last character**, deliberately unlike the OTP screen. There the boxes were the only field, so filling them plainly *was* the action. Here the form also carries an email that may still be empty when the sixth letter lands, and submitting early would spend one of only five attempts a minute against a code with no expiry.
- **A reset token that expires mid-form sends the user back to the code stage** with the dead token discarded. The recovery code itself does not expire, so it is still the right one to retype.
- Success returns to the login view through the existing `handoff` mechanism — email pre-filled, `passwordUpdated` shown inline.

### Why there is no email: the platform post-mortem, kept for the lesson

The mail code is gone; this stays because the constraint is the *platform's*, not Gmail's, and the next outbound service will meet it too.

Verification emails failed in production with `ENETUNREACH` against `2a00:1450:...:587`. `smtp.gmail.com` has both an A and a AAAA record, and Render's outbound network does not route IPv6.

**What made it intermittent is the part worth remembering.** Nodemailer does its **own** DNS resolution — `dns.Resolver().resolve4()` and `resolve6()` directly, never `dns.lookup` — concatenates the results IPv4-then-IPv6, and then picks **one at random**. With one A and one AAAA record that is a coin flip per send; measured, 18 of 40 resolutions chose IPv6.

Both standard fixes were measured and **neither worked**, which is the actual lesson:

| Configuration | IPv4 chosen | IPv6 chosen |
|---|---|---|
| Plain | 22/40 | 18/40 |
| `family: 4` in the transport options | 21/40 | 19/40 |
| `dns.setDefaultResultOrder('ipv4first')` | 23/40 | 17/40 |

- **`family: 4` never reaches the socket.** The options nodemailer passes to `net.connect` are a fixed set, and `family` is not among them. Even if it arrived it would be moot: the host has already been overwritten with an IP **literal**, and `family` only steers `dns.lookup`, which no longer runs.
- **`setDefaultResultOrder('ipv4first')` only affects `dns.lookup`**, which nodemailer bypasses entirely. It cannot reorder a list it never produces.

**Generalise this, don't memorise the fix.** No outbound IPv6 is a property of the environment. When any external TCP/HTTPS call from here behaves oddly, establish **which resolution path the library takes** before reaching for `family: 4` by reflex — Node's own `fetch`/undici use `dns.lookup`, where `setDefaultResultOrder('ipv4first')` *does* work, and a library that resolves for itself needs the address resolved on its behalf instead. Separately, several PaaS tiers block outbound SMTP ports outright; if email is ever reintroduced, use a provider whose API goes over HTTPS rather than SMTP.

### Adding to this flow

Both DTOs restate the shared rules by hand for the usual reason. `ResetPasswordDto` carries a **third** copy of the password policy alongside `passwordSchema` and `RegisterDto` — edit all three together; a reset that accepted a weaker password would be a documented way around the policy. New copy goes in the `auth` namespace of all three message files, as always.

**Never log the plaintext recovery code**, on any path, including error paths — the same rule the OTP code had, for the same reason, except that this one has no ten-minute expiry to outlive.

## Rate limiting and security headers — both are already there, don't add a second copy

Two API-wide layers, added together. Neither is visible in normal use, which is exactly why they get reintroduced by someone who cannot see them working.

### `@nestjs/throttler`: the numbers, and the fact that the window is per route

`ThrottlerGuard` is registered as a global `APP_GUARD` in `app.module.ts`, so **every route is limited by default** and a new controller needs no decorator to be covered. All the numbers live in `apps/api/src/throttle.constants.ts` and nowhere else — there is no client-side copy and no second literal in a decorator.

| Route | Per minute, per IP | Constant |
|---|---|---|
| Everything, by default | **100** | `DEFAULT_LIMIT` |
| `POST /auth/login` | **5** | `LOGIN_LIMIT` |
| `POST /auth/signup` | **10** | `SIGNUP_LIMIT` |
| `POST /auth/verify-recovery-code` | **5** | `RECOVERY_CODE_LIMIT` |

- **The window is per *route*, not per app.** `ThrottlerGuard`'s key is `sha256(<Controller>-<handler>-<throttler name>-<ip>)`, so `DEFAULT_LIMIT` is 100 requests/minute *to each endpoint* from one address, not 100 across the API. That is what lets the default be generous: a browsing session spends its budget on `/tmdb/discover` and `/tmdb/search` separately and cannot eat into what the next `/auth/login` gets. **Don't "fix" this into one app-wide bucket** — the per-route overrides reuse the same throttler name (`default`), so a global key would make them share that bucket at their own much smaller limit, and any five requests anywhere would lock login.
- **Two of these limits are the only defence, not a supplement.** There is no account lockout anywhere in this app, so `POST /auth/login` has nothing else limiting password guesses against a known address. `POST /auth/verify-recovery-code` is stricter still in what it protects: a recovery code has **no expiry and no per-code attempt ceiling**, so this limit is the entire thing standing between an attacker and an unlimited guessing run. Loosening either is a security decision. `SIGNUP_LIMIT` is the ordinary kind of backstop — it blunts scripted mass account creation without punishing a shared egress IP.
- **The 429 body is the throttler's own and is deliberately left alone**: `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }`. It names no account, echoes no input and carries no `code`. Verified on the wire.
- **Rate limiting does not weaken `verify-recovery-code`'s non-disclosure.** The limit counts the caller's address, never the submitted email, so the answer for any given address is still identical whether or not it has an account. Its 429 carries no `code`, unlike the endpoint's own 400 — the client shows a "wait a minute" message for it rather than falling through to a generic error.
- `X-RateLimit-{Limit,Remaining,Reset}` are on every response, and `Retry-After` on a block. Handy for checking a limit applied without exhausting it: `curl -sD - -o /dev/null -X POST localhost:3000/auth/login` should show `X-RateLimit-Limit: 5`.
- **Storage is in-memory, per process.** Counters reset on restart and each instance keeps its own, so **running more than one instance multiplies every limit by the instance count** — that is the point at which this needs a shared store (`ThrottlerStorageRedisService`), not a bigger number.
- **`TRUST_PROXY` is load-bearing once deployed.** The tracker is `req.ip`, which Express reads off the socket unless told a proxy is in front. Behind a load balancer without it, every request carries the balancer's address and the entire internet shares one bucket. It is unset by default because the opposite mistake is worse: trusting `X-Forwarded-For` when nothing rewrites it lets a client forge a fresh address per request and the limits stop meaning anything. Set `TRUST_PROXY=1` (one hop) only where a proxy really is in front.
- **`TRUST_PROXY` got more important with the Vercel proxy, and `1` is probably now the wrong value.** Browser-side traffic — auth, `user-movies`, the typeahead — used to reach Render from the visitor's own address. It is now proxied through Vercel (see the deployment section), so it arrives from Vercel's egress, behind Render's load balancer: **two** hops, not one. Unset, `req.ip` is identical for every visitor and `LOGIN_LIMIT`'s 5/minute becomes a global budget that locks real users out as soon as two of them sign in at once. Verify the number rather than guessing it — hit an endpoint from two different networks and confirm `X-RateLimit-Remaining` counts down independently.
- **Known, and deliberately not solved yet: `/tmdb/*` is called by Next's *server*, not the visitor's browser.** Every server-rendered Discover, Search and movie page is one request from the Next process's own address, so in production all visitors share a single 100/min bucket per catalogue route, and `TRUST_PROXY` cannot help because that traffic genuinely originates there. Fine at current scale; before real traffic the choice is to raise `DEFAULT_LIMIT` substantially or `@SkipThrottle()` the public catalogue routes and lean on TMDB's own limit plus Next's `fetch` cache.

### `helmet`: global, defaults, and CSP is off on purpose

`app.use(helmet({ contentSecurityPolicy: false }))` in `main.ts`, **before** anything that can answer a request so error responses carry the headers too. Everything else is stock: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, `Cross-Origin-{Opener,Resource}-Policy`, `X-DNS-Prefetch-Control`, `Origin-Agent-Cluster`, and the `X-Powered-By` removal.

- **CSP is the one default disabled, and it is a considered exception rather than an oversight.** This is a JSON API: CSP governs what an HTML *document* may load, so on every route the frontend calls it constrains nothing — that protection belongs to the Next app, on its own origin, with its own headers. The only HTML served here is Swagger UI at `/docs`, and `@nestjs/swagger` bootstraps it with an **inline `<script>`**, which helmet's default `script-src 'self'` blocks outright — `/docs` renders blank, and it is a page this project relies on for manual testing. The alternatives are `'unsafe-inline'` (no policy, dressed as one) or a hand-tuned per-route CSP (real work, easy to get subtly wrong). **Off and documented is the honest option. Write a policy the day HTML that matters is served from this origin, not before.**
- **`Cross-Origin-Resource-Policy: same-origin` does not break the frontend.** It is enforced against `no-cors` subresource loads, not against the credentialed CORS `fetch` every web-app call makes. Posters load straight from `image.tmdb.org` rather than being proxied through here, so nothing on this origin is fetched as a bare subresource.
- Helmet does not replace the CORS config — they answer different questions, and `enableCors` still runs after it, unchanged.

## Client auth state: `useCurrentUser` and the `['auth','me']` key

`hooks/use-current-user.ts` is the **single source of truth** for "is someone signed in, and who". Anything that needs to know — the library-action gate, the navbar account control, and the modal's submit once it lands — reads this hook rather than tracking its own flag or calling `/auth/me` again.

- **Query key is `['auth','me']`** (`CURRENT_USER_QUERY_KEY`). Invalidate it after any change to the session — login, register, logout — and every consumer re-reads. `useLogoutMutation` already does this in `onSettled` (settled, not success: a failed logout leaves the cookie's state unknown, so re-reading is right either way).
- **Logging out navigates to Discover, and that lives in the hook rather than in the button.** `useLogoutMutation`'s `onSettled` finishes with `router.replace(DISCOVER_HREF)` — `useRouter` from `@/i18n/navigation`, so the active locale is preserved and the `/moviex` base path is added by Next; a hard-coded path would lose both. Signing out *in place* was the bug: on `/my-list` the page emptied out and on a movie detail page the action buttons silently reverted, which reads as breakage rather than as a logout that worked. `replace`, not `push` — Back should not return to the page they just signed out of, which would only render that same signed-out state. It sits with the cache work in `onSettled` for the same reason the rest of it does: the session is discarded whether or not the request succeeded, so navigating only on success would strand exactly the case where the UI has gone signed-out but the page has not. **New callers get this for free; don't re-add a redirect at the call site.**
  - **This and `/my-list`'s own signed-out redirect both fire when you log out from that page, and only one of them may speak.** `MyListView` tracks whether the mount ever held a session (`hadSessionRef`) and skips `requestAuthNotice()` when it did — telling someone who just chose to sign out that they "need to sign in to view your list" answers a question they did not ask. Any future page that both gates on auth and can be logged out from owes the same check.
- **A 401 is the logged-out answer, not an error** → the query resolves to `null`, with `retry: false` so React Query doesn't hammer a correct rejection. `staleTime` is 5 minutes.
- **`credentials: "include"` is mandatory** on every auth call: the token is an httpOnly cookie JS cannot read, so the browser must be told to attach it cross-origin. This is also why the API's CORS has to name the exact origin — see the LAN-testing section.
- **`/auth/me` returns `{ sub, email, userName, iat, exp }`.** `sub`/`iat`/`exp` come from the token, but **`userName` is joined from the `users` row** — the JWT deliberately does not carry it, because the cookie rides on every request and should stay small. Reading the row also means a username change shows up on the next `/auth/me` rather than being frozen until the token expires. A structurally valid token whose account no longer exists is a **401**, not a session.
- **The navbar menu displays `userName`, never the email**, and `initialsFrom(user.userName)` builds the avatar's initials (`najaf` → `NA`, `ada.lovelace` → `AL`). Email is what you sign in *with*, not what identifies you afterwards. This replaced an `initialsFromEmail()` that only existed because `/auth/me` had no username to offer.
- **Gating is three-way, never two.** `useLibraryActions().requireAuth()` no-ops while auth is *loading*, opens the modal only once logged-out is **confirmed**, and runs the action when signed in. Treating "unknown" as "logged out" flashes the login modal at users who are actually signed in — that is the bug this shape exists to prevent.

## Fetch failures use `error.tsx`, not try/catch

A Server Component that cannot reach the API **throws**, and the route's `error.tsx` catches it — there is no try/catch inside the page components, and adding one would break the pattern (`reset()` only exists on the boundary).

- Boundaries live at `app/[locale]/error.tsx` (Discover — note Discover **is** the root route, there is no `/discover` segment), `app/[locale]/search/error.tsx`, and `app/[locale]/movie/[tmdbId]/error.tsx`. The first also covers any future child segment that has no boundary of its own. None of them catch errors thrown by `app/[locale]/layout.tsx` itself — that needs `global-error.tsx`.
- All three render the shared `components/shared/ErrorState.tsx`; only the heading differs, and each boundary translates its own (`errors.discoverTitle` / `searchTitle` / `movieTitle`) before passing it in. Add a heading key rather than a second copy of the markup. The boundaries sit **inside** `[locale]`, so `NextIntlClientProvider` from the layout is above them and `useTranslations` works — one at `app/` would render outside the provider and could only show untranslated text.
- **"Try again" calls the boundary's `reset()`**, which re-renders the segment and re-runs the fetch. Not `window.location.reload()`, which would discard client state and reload every other segment.
- The error is `console.error`'d in a `useEffect`; **`error.message` is never rendered** — it can carry internal hostnames and stack detail.
- **This is not the empty state.** `discover.empty` and `SearchEmptyState` mean "the request succeeded and matched nothing"; the boundary means "we could not reach the server". Keep them distinct, or a user sees "no movies match your filter" when the API is simply down.
- Worth knowing when testing: in a production build a thrown Server Component error returns a **500 with an empty HTML shell**, and the boundary renders on the client after hydration. `curl` will not show the styled message — check it in a browser.

### A short retry sits in front of those boundaries — this is already handled, don't "fix" it again

Every function in `lib/api.ts` goes through **`fetchWithRetry()`**, which retries **twice** (300ms then 600ms) and then rethrows the original error untouched. It exists because the API can be briefly unreachable at a moment nobody chose: `npm run dev` starts both apps in parallel and Next becomes ready before Nest has finished connecting to the remote Supabase Postgres, so the very first server-rendered Discover fetch could hit a port nothing was listening on and blow up with `TypeError: fetch failed` / `ECONNREFUSED`. The same window opens in production every time the API restarts during a deploy, which is why this is not a dev-only workaround.

- **Only a throwing `fetch` is retried** — the connection never got made. An HTTP **response** is a real answer from a server that is up, so a 404, 400 or 503 is returned on the first attempt and never repeated. Retrying a status code would multiply load on an API that is already struggling and delay an error the user needs to see.
- **An `AbortError` is never retried.** The typeahead cancels superseded searches; retrying one would resurrect a request whose result is already unwanted.
- **Nothing downstream changed.** After the retries are exhausted the error propagates exactly as before, so discover/search/detail still throw into `error.tsx`, `getGenres` still degrades to `[]`, and a movie 404 still becomes `null`. This adds ~900ms of window in front of that policy and nothing else.
- Keep the budget small. It is sized to bridge a gap of milliseconds-to-low-seconds, not to hide a backend that is genuinely down behind a long spinner.

**`apps/web` also has a `predev` script** — `wait-on http-get://localhost:3000 -t 15000` against the API's `GET /` — so the web dev server usually does not start until Nest is answering. It is a convenience, not the fix: on timeout it prints a note and lets `next dev` start anyway, and it only ever helps at process startup. `fetchWithRetry` is what covers a mid-session blip. Do not remove one on the grounds that the other exists.

## Deployment: `habiboff.cc/moviex`, and the Vercel proxy in front of the API

**The public app is `https://habiboff.cc/moviex`. `moviex-web-one.vercel.app` and `moviex-skr4.onrender.com` are internal implementation details now — hosting addresses, not URLs anyone is given.** The root of `habiboff.cc` is deliberately left free for a separate personal site; MovieX is mounted on a sub-path and nothing it serves answers at `/`.

Two pieces of `apps/web/next.config.js` do the whole thing, and they are related: the base path is what makes a sub-path mount possible, and the rewrite is what makes the API look like part of it.

### `basePath: '/moviex'`

Next prefixes it automatically onto `next/link` hrefs, `router.push` / `router.replace`, server-side `redirect()` (verified: `app-render` wraps every redirect URL in `addPathPrefix(url, basePath)`), `_next/*` assets, and the `app/` icon file conventions. **So no route in this app is written with the prefix** — `<Link href="/my-list">` still renders `/moviex/tr/my-list`, `Pagination` still copies params forward onto plain locale-free paths, and `DISCOVER_HREF` is unchanged. Confirmed on a real build's HTML: every `href`/`src` came out `/moviex/…` with no component touched.

It is a **build-time** constant, inlined into the client bundle. Changing it needs a rebuild, not a restart.

next-intl needs no configuration for it. Its middleware reads `request.nextUrl.basePath` and re-applies the prefix to every redirect and rewrite it emits, and it scopes the `NEXT_LOCALE` cookie's `path` to the base path — observed on the wire as `set-cookie: NEXT_LOCALE=en; Path=/moviex`. `usePathname()` still answers the locale-free, prefix-free `/my-list`.

**The one thing that does *not* come for free is the middleware matcher, and getting it wrong 404s the front door.** See `proxy.ts`: matcher sources are written relative to the base path, because Next concatenates the configured `basePath` onto the front of each `source` before compiling it. The single-entry matcher this app used to have compiles to a regex that requires the separator after `/moviex` — and Next's own `trailingSlash: false` redirect has already turned `/moviex/` into `/moviex` by then. Net effect: **`/moviex` matches nothing, skips next-intl entirely, and 404s instead of redirecting to `/moviex/en`.** The fix is an explicit `'/'` entry alongside the exclusion pattern, which is what next-intl's own docs prescribe for a base path. Measured before and after against Next's `getMiddlewareMatchers`, then confirmed against the built `functions-config-manifest.json` and a live request:

| Request | Matcher without `'/'` | Matcher with `'/'` |
|---|---|---|
| `/moviex` | **skip** ← 404 | MATCH → 307 `/moviex/en` |
| `/moviex/` | MATCH | MATCH (308 → `/moviex` first) |
| `/moviex/en/my-list` | MATCH | MATCH |
| `/moviex/api/auth/login` | skip ✓ | skip ✓ |

`api` staying in that exclusion list is now load-bearing rather than cosmetic — it is what hands `/moviex/api/*` to the rewrite below instead of redirecting it into a locale.

### The rewrite: `/moviex/api/*` → Render, server-to-server

```js
async rewrites() {
  return [{ source: '/api/:path*', destination: `${API_PROXY_TARGET}/:path*` }];
}
```

**`source` is written *without* the base path.** Verified against this Next version's `load-custom-routes.js` rather than assumed: every `source` gets `srcBasePath` prepended, while `destination` is only prefixed when it starts with `/` (i.e. is internal). Writing `/moviex/api/:path*` here would compile to `/moviex/moviex/api/:path*`. The built `routes-manifest.json` confirms the correct output:

```json
{ "source": "/moviex/api/:path*", "destination": "https://moviex-skr4.onrender.com/:path*" }
```

**Do not add `basePath: false` either.** That option stops the base path being included *when matching*, so the rule would only fire for a bare `/api/*` this app never requests.

Returned as a plain array, which means `afterFiles`: checked after static files but **before** dynamic routes, so `app/[locale]` can never swallow an API path.

The destination comes from `API_URL` — Next runs `loadEnvConfig` before evaluating `next.config.js` (checked in `server/config.js`), so `.env` is available there. One value drives both the proxy target and the Server Components' direct fetch target, and it means the proxy path can be exercised locally against `http://localhost:3000` instead of only ever in production.

### The full request path, walked end to end

Browser at `https://habiboff.cc/moviex/en` submits the login form:

1. `fetch("/moviex/api/auth/login", { credentials: "include" })` — **relative**, so same-origin with the page. No preflight, no CORS, no third-party cookie.
2. Vercel: redirects checked (none match), then the middleware matcher — `/moviex/api/…` is excluded, so next-intl never sees it.
3. `afterFiles` rewrite matches `/moviex/api/:path*` and Vercel proxies **server-side** to `https://moviex-skr4.onrender.com/auth/login`, body and query string intact.
4. Nest answers `200` with `Set-Cookie: access_token=…; Path=/; HttpOnly; Secure; SameSite=Lax`.
5. Vercel pipes the response back unchanged, `Set-Cookie` included.
6. The browser attributes that header to the request it actually made — to `habiboff.cc` — and stores the cookie for that host at `Path=/`. Every later `/moviex/api/*` call is **same-site**, so `Lax` sends it.

Steps 3–6 were verified against a production build served locally, with real responses from the deployed Render API: `Set-Cookie` passes through intact, POST bodies and multi-param query strings survive, `X-RateLimit-*` headers arrive, `/auth/me` with no cookie is a clean 401, and `/` (outside the base path) is a 404.

`Path=/` rather than `/moviex` is deliberate: the API is a separate origin server-side and knows nothing about where Vercel mounts the app, and `/` is also what Swagger UI at `<api-host>/docs` needs, since that page is served from the API's own origin directly.

### Consequence to check before trusting the rate limits: every browser call now arrives from Vercel

This is the one thing the proxy makes *worse*, and it is not visible from the code. Browser-side traffic — `auth`, `user-movies`, the typeahead — used to reach Render from the visitor's own address. It now arrives from Vercel's egress, behind Render's load balancer. With `TRUST_PROXY` unset, `req.ip` is the same for everyone and **`LOGIN_LIMIT`'s 5/minute becomes a global budget**, locking real users out as soon as two of them sign in at once. `/tmdb/*` already had this problem via server rendering; it now covers the sensitive routes too.

There are **two** hops now, not one, so `TRUST_PROXY=1` is probably not the right number. Don't guess it — hit an endpoint from two different networks and confirm `X-RateLimit-Remaining` counts down independently. See the throttler section for what the setting does and why over-trusting it is the opposite failure.

### Local development

`basePath` is not conditional — dev and production must not diverge on routing — so the app now lives at **`http://localhost:3001/moviex`** locally too.

The rewrite works in `next dev` as well, which gives two workable local setups. `apps/web/.env.example` documents both:

- **Mirror production** (the committed default): `NEXT_PUBLIC_API_URL=/moviex/api` with `API_URL` pointing at Render. The browser goes through the local Next server's proxy, so the same code path runs. Caveat: the deployed API issues a `Secure` cookie, which browsers accept over `http://localhost` but this is the one place the setup is not literally identical.
- **Run Nest locally**: both variables set to `http://localhost:3000`. The dev API issues a non-`Secure` `Lax` cookie and `localhost:3001` → `localhost:3000` is same-site, so this always works.

## Testing on a phone / LAN device

This is for testing against a **locally run** API. Point both ends at the dev machine's LAN IP; changing only one leaves requests blocked or unroutable. Find the IP with `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).

**Mind the ports:** the **API is on 3000**, the **web app on 3001**. `FRONTEND_URLS` lists *frontend* origins (`:3001`); `API_URL` / `NEXT_PUBLIC_API_URL` point at the *API* (`:3000`). Mixing them up is the usual reason "it works on localhost but not on the phone". And the app is under a base path now, so the frontend URL to open is `http://<LAN-IP>:3001/moviex`.

Testing the *deployed* app from a phone needs none of this — it is all one origin, which is the entire point of the proxy above.

1. **`apps/api/.env` — `FRONTEND_URLS`**: a comma-separated list of allowed CORS origins, e.g. `https://habiboff.cc,http://localhost:3001,http://192.168.1.10:3001`. **Deployed, this is now a safety net rather than the load-bearing path** — the browser reaches the API through Vercel's rewrite, which is a server-to-server call and not subject to CORS at all. Keep `https://habiboff.cc` listed anyway so a direct browser call still works, and keep localhost for a locally-run frontend; the section below is still the right reading on how the matching works. Every entry stays valid at once, so adding the phone does not break localhost. `main.ts` passes a **validation function, never a static string**, to `enableCors` — in *every* environment, production included (see below for why that distinction cost a debugging pass). A request with no `Origin` header (curl, health checks, same-origin Swagger UI) is allowed; an unlisted origin gets no allow-header and the browser blocks it. `FRONTEND_URL` (singular) is still read as a fallback. **Matching is on canonical origins, not raw strings**: both sides go through `canonicalOrigin()` (`new URL(x).origin`, lowercased, after stripping wrapping quotes), so a trailing slash, a pasted pair of quotes, a stray path, a differently-cased host or a zero-width space in the env var cannot read as a different origin. It loosens nothing — two genuinely different hosts, or `http` against `https`, still do not match — and an entry with no scheme canonicalises to `null` and is dropped from the allow-list with an error logged, rather than sitting there matching nothing.

### The production CORS bug: a static `origin` asserts a value the caller never sent

Deployed on Render with the frontend on Vercel, every browser call failed with `Access-Control-Allow-Origin: http://localhost:3001` — an origin that appears nowhere in the deployed config. Two faults compounded, and only the first is a code bug.

**1. Production used to pin to `allowedOrigins[0]` — a static string.** The multi-origin validation function ran only in development. Handing the `cors` package a static origin makes it echo that value back **regardless of who asked**, so the API answered a request from `https://moviex-web-one.vercel.app` by asserting `http://localhost:3001`. Measured against the real `cors` package rather than reasoned about:

| Config | `Origin: https://moviex-web-one.vercel.app` → ACAO |
|---|---|
| Old, static, `FRONTEND_URLS` **missing** | `http://localhost:3001` ← the reported symptom |
| Old, static, `FRONTEND_URLS` set | `https://moviex-web-one.vercel.app` |
| New, function, `FRONTEND_URLS` missing | *no header* |
| New, function, list includes Vercel | `https://moviex-web-one.vercel.app` |

**`DEFAULT_FRONTEND_ORIGIN` was blamed and was not the bug.** It is reached through `??`, so a `FRONTEND_URLS` that is set — however wrong-looking — is always used; grepping the constant and finding it *near* the CORS config is not evidence it was in play. Read row 2 of that table: with the variable set, the old code emitted the right origin. **The symptom is only reproducible when the variable is genuinely absent from the running process**, which is the second fault.

**2. The variable was set in the dashboard but not in the process serving traffic.** Worth knowing because it is invisible from the code: a failed Render build leaves the *previous* instance running, and that instance carries the environment it started with. During this period Render builds were failing (`EBADDEVENGINES`, then Turborepo's missing `packageManager`), so a variable added between deploys never reached the live process. **Confirm a config change actually landed by reading the startup log of the deploy that is serving, not the dashboard.**

**The durable fix is the function.** A validation function can only ever echo the caller's own origin or send no header at all, so a misconfigured list now fails honestly as "origin not allowed" instead of asserting a third origin nobody mentioned. It also lets production allow several origins — a deployed frontend, Vercel preview URLs, localhost — which the old first-entry pin structurally could not.

- **An env var that is present but *empty* is treated as unset.** `??` accepts `''` and would leave the allow-list empty, allowing nothing; parsing uses `||` on the trimmed value so the fallback applies to genuinely-missing config only.
- **The `CORS allows:` startup line is logged in every environment, production included**, and a production fallback to `DEFAULT_FRONTEND_ORIGIN` additionally logs a warning — that state means no deployed frontend can call the API. It used to be wrapped in `if (!isProduction)`, which is exactly why the misconfiguration was invisible. **Don't make CORS diagnostics dev-only**; production is where the origin list is hardest to see, not easiest.

### The session cookie is `SameSite=Lax` everywhere — and the reason it can be is the proxy

`accessTokenCookieOptions()` in `apps/api/src/auth/auth.constants.ts` is the single definition of the session cookie's attributes, used by **both** the write (`AuthController.setSessionCookie()`, which login *and* signup go through) and the clear (`logout`). There are no inline options at any call site, and there must not be: the two have to match attribute-for-attribute or the browser scopes the clear to a different cookie and the original survives.

| | `sameSite` | `secure` |
|---|---|---|
| Production | **`lax`** | `true` |
| Development | **`lax`** | `false` |

`sameSite` is now a **constant**; only `secure` still follows the environment (HTTPS in production, plain HTTP locally where `Secure` would drop the cookie entirely). Every request that carries this cookie is same-site in both environments — `habiboff.cc` → `habiboff.cc/moviex/api/*` through the Vercel rewrite, and `localhost:3001` → `localhost:3000` locally.

**This reversed the previous production `sameSite: 'none'`, and the history is why the rule is worth stating rather than just the value.** Deployed directly, the frontend and API were on genuinely different sites — `*.vercel.app` and `*.onrender.com` — so every call was cross-site, and under `lax` the browser **stored the cookie and then declined to attach it to `fetch()`**; only top-level navigations carried it.

**That failure mode is worth recognising on sight, because nothing looks broken.** `POST /auth/login` returns 200, the `Set-Cookie` header is present and correct, and DevTools → Application → Cookies shows the cookie sitting there — while the very next `GET /auth/me` 401s with "Missing access token cookie". A cookie that is visibly *present* but never *sent* points at `SameSite`, not at the login handler.

`none` + `secure` fixed that on Chrome and Firefox — **and then failed anyway on mobile Safari/Brave and anything else on WebKit, which blocks third-party cookies outright regardless of what the attributes say.** No combination of cookie attributes can win that argument. Proxying is what actually *removed* the cross-site request rather than negotiating with it, and going back to `lax` is a consequence of that, not an independent tightening.

- **Do not put `none` back without also removing the proxy.** If the two halves are ever served from different sites again, `none` + `secure` is required — and `none` is only honoured together with `Secure` (a `SameSite=None` cookie without it is rejected by every current browser), which is why that pair has to move together.
- **Development was always `lax`, and for the same underlying reason**: `localhost:3001` → `localhost:3000` is *same-site* (one registrable domain). This is why the whole class of bug was invisible locally — the LAN-testing note below about matching hosts is the same trap wearing a different hat.

**CSRF: `lax` restores what `none` had given up.** With `none`, a cross-site POST from an attacker's page could carry the session cookie, and CORS did not close it — the `cors` middleware omits response headers for an unlisted origin, but the request still **executes**, a plain HTML form POST is not preflighted, and Nest's default body parsers accept `application/x-www-form-urlencoded`, so `POST /user-movies` was reachable. Under `lax` it is not. The note that used to sit here proposing an `Origin`-checking global guard is no longer the cheapest fix available; leave it out unless the cookie ever goes back to `none`.

2. **`apps/web/.env` — `NEXT_PUBLIC_API_URL`**: for this scenario, the LAN IP, e.g. `http://192.168.1.10:3000`. A phone cannot resolve `localhost` to your machine, and the typeahead and every auth call fetch from the **browser**, so they use this public variable rather than the server-only `API_URL`. **`NEXT_PUBLIC_*` is inlined at build time — restart the dev server after changing it**, or the old value stays compiled into the client bundle.

**The two variables are no longer the same value, and `lib/api.ts` resolves them separately.** `NEXT_PUBLIC_API_URL` is what the *browser* calls — the relative `/moviex/api` in production, an absolute host when talking to a local API directly. `API_URL` is what the *server* calls and must always be absolute: `fetch("/moviex/api/…")` from a Server Component has no origin to resolve against and throws. So `API_URL` takes priority on the server precisely because the public one is a relative path there. The export is picked once per bundle on `typeof window`, which is why each side gets its own answer.

> **When the browser talks to the API directly, the API host must match the host the browser is on.** This is not a preference — it is what makes auth work at all. The session is a `SameSite=Lax` cookie, so a browser at `http://localhost:3001` calling an API at `http://192.168.31.53:3000` is a **cross-site** request: the cookie is never stored or sent, `/auth/me` answers 401 forever, and the whole app looks signed out — while `POST /auth/login` still returns 200 with a `Set-Cookie` header, which is exactly what makes this so hard to spot. It cost a full debugging pass once.
>
> - Working on the dev machine → `NEXT_PUBLIC_API_URL=http://localhost:3000`, browse `http://localhost:3001/moviex`.
> - Testing from a phone → `NEXT_PUBLIC_API_URL=http://<LAN-IP>:3000`, and open the frontend at `http://<LAN-IP>:3001/moviex` too — **not** `localhost`.
>
> `lib/api.ts` warns in the console (dev only) when the two hosts disagree, so the next occurrence is loud rather than silent. **A relative value is exempt from that check** — it is the proxy path, same-origin by construction, with no host to compare.

`.env.example` in both apps documents the full set. `apps/web/.gitignore` negates its `.env*` rule with `!.env.example` so the template stays committable while real env files do not.

## Genres come from TMDB — never hard-code them

There is **no static genre list anywhere in this repo**, and adding one back is a regression. Genres are fetched live:

- `apps/api` proxies TMDB at **`GET /tmdb/genres`** (`src/tmdb/`), returning TMDB's array **unchanged** as `{ id: number, name: string }[]`. Don't rename or reshape those fields — `id` is exactly the value TMDB's `/discover/movie` takes as `with_genres`, so it passes straight through with no lookup table on either side. The route is public (no guard); `TmdbService` uses Node's global `fetch` (there is no HTTP-client dependency, and `@nestjs/axios` is not installed) with `TMDB_API_KEY` injected via `src/config/tmdb.config.ts` following the usual `registerAs` pattern.
- `apps/web` fetches it in `lib/api.ts` with `next: { revalidate: 86400 }` — **Next's `fetch` cache is the only caching layer**, deliberately: no Redis, no database. `app/[locale]/page.tsx` (a Server Component) calls it and passes `genres` down as props; the array never lives in client state.
- The shared `Genre` type is `packages/shared-types/src/genre.ts`, used by the service return type, the Swagger response (via `GenreDto`, which `implements Genre` so drift fails to compile), and every web component.
- A movie carries `MovieSummary.genreIds` (TMDB numeric ids) and each **name is resolved at render time** against the fetched list — never stored on the movie. The saved-list row is the same idea with one id: `UserMovie.primaryGenreId`.
- Selection lives in the **URL**, not state: `?genre=28`. `GENRE_SEARCH_PARAM` and `parseGenreParam()` in `lib/constants/discover.ts` are shared by the page (reads) and the chips (write), so the two cannot disagree. The "All" chip (`discover.allGenres`) is not a TMDB genre — it **deletes** the param rather than writing an "all" sentinel, and `null` means "no genre filter" throughout. A non-numeric param falls back to `null`.
- **Genre names are translated by TMDB, not by our message files.** `GET /tmdb/genres?lang=tr` returns them in Turkish; they are catalogue data, so they never appear in `messages/*.json`.

## TMDB endpoints: normalise on the way out, and cache per-endpoint

`GET /tmdb/genres` and `GET /tmdb/discover` (both public, both in `src/tmdb/`) deliberately behave differently in three ways. Match the existing one when adding a third endpoint.

- **Pass through vs. normalise.** Genres are returned in TMDB's exact shape because `id` is the `with_genres` value. Discover results are **not**: `TmdbService.toMovieSummary()` is the only place TMDB's snake_case is read, expanding `poster_path` into a full `https://image.tmdb.org/t/p/w500/…` URL (**`null` stays `null`** — concatenating it yields a URL ending in `null` that 404s) and slicing `release_date` to a four-digit `releaseYear` (`null` for TMDB's `""` undated entries). Web components are typed against `MovieSummary` / `DiscoverMoviesResponse` directly — there is no adapter layer, so an API shape change fails to compile.
- **Cache lifetime is per-endpoint, and Next's `fetch` is the only cache** (no Redis, no DB). Genres: `next: { revalidate: 86400 }`. Discover: `cache: "no-store"` — results vary per filter combination and shift with TMDB popularity, so nothing is reusable.
- **Failure mode differs on purpose.** `getGenres()` degrades to `[]` (an optional filter; losing it must not take down the page or the build). `getDiscoverMovies()` **throws**, and `TmdbService.discoverMovies()` never returns an empty page on error — an empty grid reads as "no films match this filter", which is a different and misleading claim. A discover failure is caught by `app/[locale]/error.tsx` — see the `error.tsx` section above.
- `discoverMovies(params)` **does** forward `yearFrom` / `yearTo` / `minRating`, and the chips behind them are live: `yearFrom`/`yearTo` become `primary_release_date.gte` / `.lte` widened to Jan 1 – Dec 31 of each bound (so a December release is not cut off), and `minRating` becomes `vote_average.gte`. Each is omitted from the upstream query when absent — the caller drops a filter left at its default rather than sending it. `page` is capped at `TMDB_MAX_PAGE` (500) because TMDB 400s above it, which would otherwise surface as a bogus 503.

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

### Form fields are never smaller than 16px below `md` — iOS zooms in and does not zoom back

**Any `input`, `textarea` or `select` whose computed `font-size` is under 16px makes WebKit zoom the page in on focus — and it never zooms back out on blur.** The user is left pinching to recover a layout that looks broken. It is deliberate, non-disableable accessibility behaviour on Apple's part, it affects *every* browser on iOS (Brave and Chrome there are WebKit too), and it does not happen on Android.

**The rule: every text-entry field carries `text-[16px]` at the base breakpoint.** A smaller desktop size is fine as a `md:` variant — `text-[16px] md:text-[13px]` is the shape used throughout — because Tailwind is mobile-first, so the *unprefixed* class is the one a phone gets. Checking a field's `md:` size tells you nothing about this bug.

- **Do not "fix" this with `maximum-scale=1` or `user-scalable=no` in the viewport meta.** That works by taking pinch-zoom away from the user entirely, which is a real accessibility regression and the thing Apple's behaviour exists to protect. Matching the font size is the fix Apple documents. This app has **no** `viewport` export at all — Next's default `width=device-width, initial-scale=1` has no scale limits, and it should stay that way.
- **16px exactly is safe**; the threshold is *under* 16.
- **Literal `text-[16px]`, not `text-base`.** `1rem` follows the root font size, so a visitor who has set a smaller default would drop back under the threshold. Every other size in this app is written as an arbitrary px value anyway.
- **Checkboxes, radios and range sliders are exempt** and are left alone — WebKit only zooms for text entry. `type="number"` is *not* exempt; Discover's year inputs zoom exactly like a text field.
- **`RecoveryCodeInput`'s six boxes were already compliant** at `text-[17px]`, which is a design choice that happens to clear the bar. Don't lower it.

The audited surface, as of this writing: **15 `<input>` elements, no `<textarea>`, no `<select>`, and nothing `contentEditable` anywhere in `apps/` or `packages/`.** Eleven are text-entry and all now sit at 16px or above; four are checkboxes and range sliders; the desktop typeahead field is `hidden` below `md` and carries the base 16px defensively anyway, since a sub-16px unprefixed size on a field is precisely what bites when a wrapper later changes.

Where they live, so a new one can be checked against the same list:

| File | Fields |
|---|---|
| `components/auth/LoginRegisterModal.tsx` | every text field via the shared `inputClass` string — login, register and both reset stages at once — plus `RecoveryCodeInput`'s boxes and two checkboxes |
| `components/search/SearchTypeahead.tsx` | the `md:`-only inline field and the phone overlay's field (**this was the one actually biting users**) |
| `components/discover/YearFilterPopover.tsx` | two `type="number"` year bounds, plus two exempt range sliders |

**When adding a field anywhere, put `text-[16px]` on it at the base breakpoint.** `inputClass` is the reason the auth modal needed one edit rather than eight — prefer routing new fields through a shared class string for the same reason.

### Movie detail (`/movie/[tmdbId]`)

- **`append_to_response`, never extra round trips.** `GET /tmdb/:tmdbId` fetches `/movie/{id}?append_to_response=credits,videos` — cast, crew and trailers are *not* in the base payload, but appending them keeps it to **one** upstream request instead of three, which matters for both latency and TMDB's rate limit. Any further sub-resource (`images`, `recommendations`, …) belongs in that same list, not in a second call.
- **Route order matters.** `@Get(':tmdbId')` is declared **last** in `TmdbController`. Nest matches in declaration order, so a wildcard above `genres` / `discover` / `search` would swallow them and answer `/tmdb/genres` with "no movie with id genres". `ParseIntPipe` is the second line of defence.
- A TMDB **404 maps to our 404** (opt-in per call via `request()`'s `notFoundMessage`); every other upstream status stays a 503, because it means TMDB is broken, not that the caller asked for something absent.
- **Cached one hour** (`next: { revalidate: 3600 }`), deliberately unlike search/discover's `cache: 'no-store'`: a single movie is a stable resource, while result lists depend on a query and shift with TMDB popularity. Pick the cache policy from whether the resource is stable, not by habit.
- **Elements overlapping a backdrop need their own separation treatment.** A film's backdrop and poster come from the same palette, so the poster's top half dissolves into the band it overlaps. Two things fix it and both are required: a `--mx-hero-overlay` (`rgba(0,0,0,0.42)`) layer above the image but below the controls — which also makes white button text readable over bright backdrops — and a **light hairline** `--mx-poster-edge` plus a lift shadow on the poster. A page-background-coloured border does *not* work: it separates the poster from the page, not from the backdrop. The same applies to anything else placed over artwork later.
- **The share button opens `components/movie/SharePopover.tsx` — a small popover with the link and a Copy button, not a direct copy and not the Web Share API.** `navigator.share` opens the *platform's* sheet, which is absent on most desktops, so the same button would mean two different interactions; one popover behaves the same everywhere. Deliberately just the link — no per-network buttons.
  - **The URL is `window.location.href`, read when the popover opens, never assembled.** The app is served under a `/moviex` base path inside a locale prefix (`habiboff.cc/moviex/tr/movie/603`), so anything rebuilt from the route would have to reproduce both and would be wrong the next time either changed. Reading it on the click rather than in an effect also means the panel's first render is already correct.
  - **It is not `FilterPopover`**, whose trigger is a labelled chip with a chevron baked in; this one is the square icon button in the action row. The panel classes and the mousedown/touchstart/Escape dismissal are copied from there on purpose so the two read as the same object — if that shell ever takes a custom trigger, fold this into it.
  - **Its edge-collision default is the mirror of `FilterPopover`'s: right, not left.** The trigger sits at `ml-auto`, so left-anchoring would put the panel off the side of the window on *every* open; the measured check flips to the left edge only when hanging right would overflow. Same `max-w-[calc(100vw-1rem)]` clamp for a viewport narrower than the panel.
  - **The link renders in a `<p>`, not a read-only `<input>`** — an input would be one line needing horizontal scroll, and any field under 16px makes iOS zoom in and never back (see the form-field note above), a constraint a non-editable box has no reason to inherit. `break-all` is required: a URL is one unbroken word, so ordinary wrapping would run it out of the box. `select-all` makes one tap select the whole thing, which is the manual fallback when `navigator.clipboard` is missing — it needs a secure context, so it is simply undefined over plain HTTP on a LAN IP, which is how this app gets tested from a phone. The copy failure stays silent for that reason.
  - The copied confirmation uses **generic** tokens (`bg-mx-field` + `text-mx-success`), not the `mx-state-watched-*` set — those mean "this film is watched", and borrowing them for "copied" is how a token stops meaning anything.
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
- **`NEXT_PUBLIC_API_URL` must be set in any deployed environment**, and deployed it is the relative `/moviex/api`, not a host. `lib/api.ts` is called from both Server Components (which use the absolute `API_URL`) and, via the typeahead, the **browser** — where a server-only var is `undefined`. The public variable is the one Next inlines into the client bundle.
- Poster thumbnails use `next/image`, which is why `next.config.js` allowlists `image.tmdb.org` under `images.remotePatterns`. Any new remote image host needs adding there or it will not render.

### Discover filters live in the URL

Every filter is a search param read by the Server Component, never client state — so a filtered view is linkable and paginating re-runs the server fetch. Each param gets a `*_SEARCH_PARAM` constant plus a `parse*Param()` guard in `lib/constants/discover.ts`, shared by whatever reads and whatever writes it; follow that pair when adding one.

- `?genre=<tmdbId>` — written by the chips, cleared (not set to a sentinel) by "All".
- `?page=<n>` — 1-based, **omitted for page 1** rather than written as `?page=1`. `parsePageParam()` clamps everything out of range (`0`, negatives, `abc`, `9999`) into `[1, MAX_PAGE]` **server-side**, so a hand-edited URL can never reach TMDB and error. `MAX_PAGE` (500) mirrors the API's `TMDB_MAX_PAGE`, and the pagination UI clamps `totalPages` by it too.
- `?yearFrom=<y>&yearTo=<y>` and `?minRating=<n>` — written together by the filter popovers. Both are **omitted at their defaults** (the full 1950–current span, and "Any rating"): the default is not a filter, so it stays out of the URL *and* out of the TMDB query. `app/[locale]/page.tsx` checks `isFullYearRange` before forwarding — sending the full span would silently drop pre-1950 and undated releases from an unfiltered browse. `parseYearParam()` / `parseMinRatingParam()` clamp or discard anything out of range.
- `?sort=<MovieSortId>` — our own vocabulary (`popularity` | `rating` | `newest` | `oldest`), **not** TMDB's `sort_by` string. `SORT_OPTIONS` in `lib/constants/discover.ts` is the single place the two are mapped (`sortByFor()`), so the URL carries `?sort=rating` rather than leaking `vote_average.desc`, and a bookmarked link survives a change in TMDB's vocabulary. The default (`popularity`) is omitted from the URL, like every other filter default; `parseSortParam()` falls back to it for anything unrecognised.
- **Sort is a plain menu, not a draft popover.** `SortDropdown.tsx` reuses `FilterPopover` only for its trigger and open/close plumbing (overriding the panel padding with `p-1.5`) — picking an option commits and closes immediately, because there is nothing to stage. Draft state is for filters with several inputs to set before committing; a single-choice control should not make the user press Apply.
- **Filter popovers hold draft state; only "Apply" commits.** `components/discover/FilterPopover.tsx` is the shared shell (trigger chip, outside-click, Escape) — deliberately *not* the genre chip, which is a one-click toggle that commits immediately. The draft lives in each filter component and is reseeded from the applied props via `onOpenChange`, so closing by Escape or outside-click discards it with no extra bookkeeping. "Reset" clears the draft without closing or committing. Commit goes through `useApplyFilters()` (`hooks/use-filter-params.ts`), which merges into the existing params — never dropping `genre` — and always resets `page`. Outside-click listens on `mousedown`, not `click`, so dragging a slider thumb past the panel edge doesn't dismiss it. **The panel is edge-collision aware**: it hangs from the trigger's left edge, and a layout effect measures the rendered panel on open and flips it to `right-0` when that would overflow the viewport (plus a `max-w-[calc(100vw-1rem)]` clamp for a viewport narrower than the panel). The measurement is required rather than a guess because each caller sets its own width via `panelClassName`. Because every filter chip *and* My List's sort control are this one shell, fixing it here fixed all of them — My List's was the visible bug, since `ml-auto` parks it against the right edge.
- Pagination is numbered only — **no "load more", no infinite scroll**; a page selection fully replaces the results. `Pagination.tsx` is a Server Component whose controls are plain `<Link>`s that copy every existing param forward, so paginating never drops the active genre. Each href ends in `#results` (`RESULTS_ANCHOR_ID`, with `scroll-mt-16` clearing the sticky navbar) — that is what scrolls the grid back into view, no client scroll effect.

## Movie list flow: a card adds, and then it only reports

There are exactly **two** things a user can do with a film — put it on the **watchlist**, and mark it **watched**. This is the whole model; it may grow later, but treat it as closed until this section says otherwise. (This section used to be written in Turkish placeholder vocabulary — Listem/İzlediklerim/Ekle/İzledim — from the original mockup. The states are and always were `watchlist` and `watched`; there is no `'listed'` anywhere in the code.)

**A catalogue card is a one-way door into the list. It never changes a status it has already reported, and it never removes.** Three renderings, and only the first is clickable:

1. **No status** (`MovieSummary.userState` absent/`null`) — the **Add** button. Clicking it `POST`s the film to the watchlist. Nothing else appears on the card.
2. **`watchlist`** — the `discover.tagListed` badge ("In list"), and **no button**.
3. **`watched`** — the `discover.tagWatched` badge ("Watched"), and **no button**.

**This replaced a cycle, and the cycle is what the shape exists to prevent.** `MovieRow` kept a `ROW_ACTIONS` map keyed by state, where a saved film swapped Add for "Mark as watched" and a watched film went back to offering Add; `useLibraryActions().runCardAction` mirrored that branch for the grid. Between them, pressing one button repeatedly walked a film round `none → watchlist → watched → watchlist → …`, with nothing on the card to say which step the next press would take. **Status management is centralised on My List**, which has the whole set of actions (mark watched, move back, remove) and the layout to label them. `runCardAction` now does exactly one thing — `requireAuth(() => addToList(movie))` — and there is no state left for a card to branch on.

Consequences to respect when touching the discover screens:

- **The rule is enforced by rendering, not by the handler.** Both `MovieCard` and `MovieRow` gate the button behind `!movie.userState`, so a saved film has nothing to click rather than a button that quietly no-ops. Any third result view owes the same gate.
- **`userState` is filled in client-side, not by the API.** `/tmdb/*` is public and never joins a user's list onto its results — `DiscoverSection` and `SearchResults` merge `useMovieStatuses(tmdbIds)` onto each `MovieSummary` before rendering, and both pass `runCardAction` to the grid *and* the list, so all four views (Discover grid/list, Search grid/list) share one behaviour. (The field's doc comment in `packages/shared-types/src/movie.ts` still describes an API-side join that was never built; the shape is right, the attribution is not.)
- **`MovieRow` renders an inert spacer, not nothing, in place of the button.** The rating and the button sit in the same right-hand flex group, so dropping the button outright would pull the rating rightwards on saved rows only and break the column down the list. The spacer is `sm:`-and-up; below that the button is full-width and stacked, where a blank slot would just be a gap.
- **The underlying hooks are untouched.** `useMovieStatuses`, the three mutations, and `markWatched` / `moveBackToList` / `removeFromList` on `useLibraryActions` all still exist and are still used — by the detail page and by My List. Only the catalogue cards lost their extra steps.
- **`discover.markWatched` and `discover.markWatchedLabel` are gone from all three message files**, deleted with the row action that was their only reader. The wording itself lives on where it is still used — `detail.markWatched` ("Mark as watched") and `myList.markWatched` ("Watched") — so nothing had to be re-translated. Removing a key that no longer has a rule behind it is the convention here: an orphan reads as copy for a feature that still exists.
- **There is no rating action anywhere in this flow.** A rate button existed briefly on the list row and was deliberately removed; do not reintroduce rating (or any third state) without updating this section first. `MovieSummary.rating` is the _catalogue's_ score — display-only, not something the user sets here.
- `MovieUserState` in `packages/shared-types/src/movie.ts` is an **alias of `UserMovieStatus`** (`'watchlist' | 'watched'`), deliberately so cards, the detail page and the `user-movies` table speak one vocabulary. `userState` is optional because it is absent for signed-out users, so "absent" and "not in the list" are the same case in the UI — a signed-out visitor sees the Add button on every card, which is the point (it is what motivates signing up, and `requireAuth` opens the modal).
- The state badge renders through `components/discover/StatusTag.tsx`, shared by the grid card and the list row so the label/colour mapping cannot drift between them (`STATUS_TAGS` is `satisfies Record<MovieUserState, …>`). **Its appearance is unchanged by the Add-button redesign below** and should stay that way: it is the same top-left pill in both views.
- **The detail page is a separate system and is deliberately not aligned with this.** `MovieActions` has its own three-button layout with the full set of actions; none of the above applies to it.

### The card's Add button

`MovieCard`'s Add button is a **40px circle, bottom-right of the poster** (`right-[9px] bottom-[9px]`) — not the full-width accent bar it used to be along the bottom edge. The badges own the top of the poster (status left, rating right), so the bottom-right corner is the only spot that collides with neither, and a circle that small leaves the artwork readable. The plus inside stays 18px; the diameter went 34 → 40 on its own, so the icon sits in more breathing room rather than growing with it.

- **Hidden until the card is hovered — on hover-capable devices only.** `opacity-0 pointer-events-none` at rest, `group-hover:` / `group-focus-within:` to reveal, and `[@media(hover:none)]:opacity-100` to keep it permanently visible on touch, where there is no hover intent to key off and a button you cannot reveal is a button that does not exist. This is the same split `MyListCard` uses for its hover actions — **reuse that idiom rather than inventing a detection method.** The reveal is keyed to the **card**, not the button: a control that only appears once you are already on it is not discoverable.
  - `pointer-events` follows the opacity in both directions, so an invisible button is never clickable.
  - Those utilities set `opacity` and `pointer-events` **and nothing else, deliberately** — no `transition-*` utility. The transition lives on `.mx-add-fab` in `globals.css`, and a `transition-opacity` here would replace its `transition-property` and silently kill the button's scale animation.
  - The poster's hover scrim stays; it now reads as the card's hover state and gives the glow something to sit against.
- **The choreography lives in `globals.css` under `.mx-add-fab`, not in the component's class attribute** — the one exception in this app besides `.mx-range`. It needs pseudo-elements with their own `@keyframes`; written as arbitrary variants it would be unreadable. The button's *appearance* is still Tailwind utilities and `--mx-*` tokens on the element. Two things move:
  1. **The button** springs to `scale(1.12)` over 280ms on `cubic-bezier(0.34, 1.56, 0.64, 1)` — an easeOutBack that overshoots ~10% past the target before settling. Keyed to the **button's** own hover, since it is a press affordance.
  2. **Two sonar waves**, on `::before` and `::after`: `scale(1) / opacity 0.5` → `scale(1.75) / opacity 0`, **1300ms, `ease-out`, `infinite`**, with `::after` given `animation-delay: 650ms`. Keyed to the **card's** hover, so they are already running as the button fades in.
- **`animation-delay` is the *only* difference between the two rings, and it must stay that way.** One keyframe, one duration, one timing function, half a period apart — so a second wave is always on its way out as the first fades and the two can never drift. Giving the second its own keyframes or duration is how a "double ping" turns into two unrelated animations.
  - **The hover rule sets `animation-name` / `-duration` / `-timing-function` / `-iteration-count` as longhands, never the `animation` shorthand.** The shorthand resets every unspecified sub-property, which would silently zero the `animation-delay` sitting on `::after` and put both rings back in lockstep. Verified on the built stylesheet: `.mx-add-fab:after{animation-delay:.65s}` survives as its own rule.
- **The plus does not move at all** — no rotate, no scale, no pulse, on hover or otherwise. It had a rotate-and-lift, then a breathing scale; both were one moving part too many next to the sonar. `.mx-add-fab-icon` exists now only to sit `z-index: 1` above the rings.
- **The loops stop wherever they are when the pointer leaves**, and that is fine: the button is fading out over the top of it. Nothing needs a clean exit frame.
- **Only `transform` and `opacity` animate, throughout.** Both composite on the GPU, so nothing costs a layout or a paint — which matters on a grid drawing twenty of these, even though only one card animates at a time. **Don't animate the glow's spread, the blur radius or the diameter** to get a similar effect: they look alike and are far more expensive.
- **The waves are stroked rings, not filled discs, and that is load-bearing.** The poster is `overflow-hidden` and a ring's centre sits 29px from its right and bottom edges, so **anything past a 29px radius is cut off** — a filled version is capped at about `scale(1.29)` for exactly that reason, which is where an earlier iteration sat. A filled disc at `scale(1.75)` would stop reading as a wave the moment it hit that boundary and become a flood in the corner bounded by two hard straight edges. A stroke just has its arc leave the frame: the wave travels up and to the left across the poster and exits, which is what sonar from a corner actually looks like. **If these are ever made solid again, the ceiling goes back to ~1.29.**
  - The 2px stroke is scaled by the transform along with everything else, so a wave thickens as it fades. Intentional.
  - Effective radius runs to `20 × 1.75 × 1.12 = 39.2px` (a ring is a **child** of the button, so it inherits the button's hover scale). It stays inside the poster on the other two sides even on the narrowest card — 2-up at 320px puts the centre 107px from the left edge and 175px from the top.
  - **The stroke is the bright `--mx-accent`, deliberately unlike the muted disc it leaves.** It has to stay legible down at ~10% opacity halfway through its travel, and the disc is now dark enough that a ring in its own colour would simply not be there.
- **`.mx-movie-card` is a marker class on the card's `<article>`**, added purely so the hand-written rules can see the card's hover. Reaching for Tailwind's own `.group` from CSS would couple `globals.css` to a utility class; the reveal itself still uses `group-hover:` on the element, where that *is* the idiomatic tool.
- **The ring paints above the button's background, not behind it, and that is forced rather than chosen.** CSS paints negative-`z-index` children *after* the parent's own background (Appendix E painting order), and this button establishes a stacking context anyway (`z-10` plus `backdrop-filter`), so a `z-index: -1` could not escape behind the disc — no arrangement of a `::before` can. Harmless: the ring is the same hue, and at `scale(1)` sitting exactly on the button's rim it reads as the wave being emitted. `.mx-add-fab-icon` is `position: relative; z-index: 1` so the plus is never crossed by it.
- **Out is quicker than in**: 180ms `ease-out` back to rest against 280ms on the way in, and no spring on the way out — a bounce leaving reads as indecisive, a fast settle reads as responsive. That asymmetry is why the rest state carries its own `transition` and each `:hover` rule re-declares one.
- **Everything except the fade-in sits inside `@media (hover: hover)`.** A phone therefore gets a permanently visible, permanently static button: no wave, no breathing, no spring. `focus-visible` mirrors all three for keyboard users, and never fires on a tap.
- **Its colours are tokens, like everything else** — `--mx-add-fab` (`rgba(80,19,19,0.92)`, so the poster reads faintly through the glass), `--mx-add-fab-border` (`rgba(255,255,255,0.2)`), `--mx-add-fab-glow` (`rgba(80,19,19,0.5)`, the `0 4px 14px` drop) and `--mx-add-fab-fg` (`#faeeda`, the plus). All four sit on `:root` with **no `.dark` override**, alongside `--mx-poster-*` and the tag colours: they sit on artwork, not on a page surface, so the theme does not change them. The rings are the one thing here that is plain `--mx-accent`; the 0.5 the design calls for is the animation's starting `opacity`, since opacity is the half that animates.
  - **The disc is deliberately no longer `--mx-accent`.** Full accent at this size was a bright dot competing with the artwork it floats over, and neither ink tried on it worked — `--mx-on-accent`'s near-black read as a smudge, white read as a sticker. Dropping it into the same deep-red family as the dark poster tints (`--mx-poster-1` is `#6b1919`) settles it into the card and leaves the bright accent for the rings, which are the part that has to read while they fade. The glow was softened to the same deep red so it reads as depth rather than as a light source.
  - **Each is its own token even where an existing one carries the identical value.** `--mx-add-fab-fg`'s `#faeeda` is exactly `--mx-state-list-fg`, but that token means "text on the In-list chip"; pointing at it from here is how a token stops meaning anything. Repointing `--mx-on-accent` would have been worse still — it is shared by every accent surface in the app, so it would have changed the auth modal's submit, the row's Add button and the detail page's actions too.
- `backdrop-blur-[8px]` is what makes the 92% background read as glass rather than as a flat translucent disc. It needs something behind it, which the poster provides; on a card with no artwork it degrades to the tone underneath, which is fine.

### Discover result views (`apps/web/components/discover/`)

`MovieGrid` (poster cards) and `MovieList` (ranked rows) are the two renderings of the same result set and take **prop-compatible** signatures, so the view toggle swaps one for the other without reshaping data. `DiscoverSection.tsx` is the client boundary that owns the active `viewMode` and renders the hero plus the matching view — `app/[locale]/page.tsx` stays a server component, which is why the toggle state lives there and not on the page. `MovieList` renders every row inside one bordered, hairline-divided surface (`bg-mx-card`), not as separate cards per film. `MovieSummary.overview` is nullable and consumed only by the list row; the grid card has no room for it. There is no runtime on a summary — TMDB's discover endpoint does not return one, so the row's meta line is "year · genre" and the figure only exists on `MovieDetail`.

# MovieX — Development Notes

## Verification policy

- Do NOT use Playwright or browser automation to verify UI changes.
- Do NOT take screenshots to self-check work.
- After writing code, just report what you changed — I will test/verify
  visually and functionally myself (via browser or Swagger).
- Exception: only use browser verification if I explicitly ask for it.
