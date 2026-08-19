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
- **Route protection**: `src/auth/guards/jwt-auth.guard.ts` (`JwtAuthGuard`) is a plain `CanActivate` that manually verifies the `Authorization: Bearer` header via `jwt.verify` (same injected `jwtConfig`) and attaches the decoded payload to `request.user` (typed via the `src/auth/types/express.d.ts` module augmentation). Pull the current user in a handler with the `@CurrentUser()` decorator (`src/auth/decorators/current-user.decorator.ts`). Protect a route with `@UseGuards(JwtAuthGuard) @ApiBearerAuth('access-token')` — the `'access-token'` name must match the scheme registered in `main.ts`'s `DocumentBuilder.addBearerAuth(..., 'access-token')` for Swagger's Authorize button to work.
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
- **Shared types**: import domain types *and validation* from `@moviex/shared-types` rather than redefining them locally. The package ships raw TS source (`exports` → `./src/index.ts`), so `next.config.js` lists it in `transpilePackages`. `src/auth.ts` holds the zod schemas both apps validate against (`loginSchema`, `registerSchema`, plus the `passwordSchema` / `PASSWORD_MIN_LENGTH` pieces the UI reuses — e.g. the strength meter parses against the same `min(8)` rule instead of duplicating it).

## Movie list flow (Listem → İzlediklerim)

There are exactly **two** things a user can do with a film — put it in **Listem**, and mark it in **İzlediklerim**. This is the whole model right now; it may grow later, but treat it as closed until this section says otherwise.

1. A film the user has not saved has no state at all (`Movie.userState` absent/`null`). Its action is **Ekle**, which adds it to **Listem**.
2. A film in Listem is `userState: 'listed'` and shows the `Listede` tag. Its action is **İzledim**, which tags it watched.
3. A watched film is `userState: 'watched'` and shows the `İzlendi` tag. It keeps the **Ekle** action, because Listem and İzlediklerim are separate lists — having seen a film does not put it in the list.

Consequences to respect when touching the discover screens:

- **Every row/card always offers an action; no state renders an empty button slot.** Only `listed` swaps `Ekle` for `İzledim`.
- **There is no rating action anywhere in this flow.** A `Puanla` button existed briefly on the list row and was deliberately removed; do not reintroduce rating (or any third state) without updating this section first. `Movie.rating` is the *catalogue's* score — display-only, not something the user sets here.
- `MovieUserState` (`'watched' | 'listed'`) in `packages/shared-types/src/movie.ts` is the single definition of the two states; `userState` is optional because the API omits it for signed-out users, so "absent" and "not in the list" are the same case in the UI.
- All copy lives in `DISCOVER_COPY` (`apps/web/lib/constants/discover.ts`): `add` / `markWatched` for the actions, `listed` / `watched` for the tags. Never inline these strings in a component.
- The state tag renders through `components/discover/StatusTag.tsx`, shared by the grid card and the list row so the label/colour mapping cannot drift between views.
- The list row derives its button from `ROW_ACTIONS` in `components/discover/MovieRow.tsx`, a total map keyed by state (`satisfies Record<MovieUserState | 'none', RowAction>`, so a new state fails to compile until it has an action). Adding a state means adding an entry there, not a conditional at the call site.
- `userState` being a single enum cannot express "in Listem **and** watched". Today `'watched'` wins and the row still offers `Ekle`; if both need to show at once, that is a change to `MovieUserState`, not to the components.

### Discover result views (`apps/web/components/discover/`)

`MovieGrid` (poster cards) and `MovieList` (ranked rows) are the two renderings of the same result set and take **prop-compatible** signatures, so the view toggle swaps one for the other without reshaping data. `DiscoverSection.tsx` is the client boundary that owns the active `viewMode` and renders the hero plus the matching view — `app/page.tsx` stays a server component, which is why the toggle state lives there and not on the page. `MovieList` renders every row inside one bordered, hairline-divided surface (`bg-mx-card`), not as separate cards per film. `Movie.runtimeMinutes` and `Movie.overview` are optional and consumed only by the list row; the grid card has no room for them.
