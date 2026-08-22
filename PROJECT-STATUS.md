# MovieX — Project Status (for resuming in a new chat)

Paste or upload this file at the start of a new conversation so Claude has
full context without re-explaining everything.

## Stack & Structure

- Monorepo: Turborepo + **npm workspaces** (not pnpm)
- `apps/web` — Next.js (App Router), TailwindCSS, TanStack Query, next-intl (planned, not yet done)
- `apps/api` — NestJS, **TypeORM**, Supabase (Postgres)
- `packages/shared-types` — Zod schemas + types, single source of truth for both apps
- Backend port **3000**, frontend port **3001**
- API testing via **Swagger**, not Postman
- Design: dark theme, red accent `#E24B4A`, established color tokens in `CLAUDE.md`

## Design decisions (why things are the way they are)

- No rating/review feature — deliberately cut. Only two states: `watchlist` / `watched`.
- Auth: httpOnly cookie-based JWT (migrated from body-token). Custom guard
  (NOT passport-jwt), reads `req.cookies['access_token']`.
- Register does NOT log the user in — they must log in separately afterward.
- TMDB integration: backend proxies everything (`TmdbModule`), API key never
  exposed to frontend. Endpoints built so far: `genres`, `discover`, `search`,
  `:tmdbId` (detail, uses `append_to_response=credits,videos` for cast+trailer
  in one request).
- `UserMovie` stores denormalized snapshot fields (`title`, `posterUrl`,
  `releaseYear`, and possibly `primaryGenre` if the My List stats bar task
  added it) sent by the client at add-time, to avoid re-fetching TMDB.
- URL-driven filters on Discover (`genre`, `page`, year range, min rating,
  sort) — all via search params, Server Component reads them.
- Nullable TMDB fields (rating, releaseYear, runtime, etc.) must be typed
  `| null` end-to-end — caused a real crash once (`vote_average` missing).
- `CLAUDE.md` at repo root has "no Playwright/browser self-verification"
  rule — Claude Code should not screenshot-check its own work.

## Built so far

- Auth backend (cookie-based login/register/logout/me)
- TMDB: genres, discover (with genre/year/rating/sort filters + numbered
  pagination), search (typeahead + results page + empty state), movie detail
  page (trailer modal, cast, details grid) — desktop sizing scaled up via
  breakpoints, mobile untouched
- `user-movies` backend module + mutation hooks (add/update-status/remove)
  wired to detail page and card Add/Watched buttons, batch status lookup
  (`GET /user-movies/status?tmdbIds=...`)
- LoginRegisterModal (login ↔ register in one modal, no separate pages)
- Auth: fully working end-to-end (login, register, logout, session
  persistence, navbar reflects real state, protected route works)
- "My List" page v2 (stats bar: Watchlist count / Watched count / Top
  genre, underline tabs, hover actions on cards, mobile `⋯` menu fallback)

## ✅ Resolved — auth end-to-end fixed

Auth was previously broken end-to-end on the frontend (navbar never showed
logged-in state, avatar always opened sign-in modal, `/my-list` always
redirected to `/discover`). An 8-step diagnostic prompt was run against the
full chain (backend cookie-setting → CORS → frontend credentials → cookie
host mismatch → guard token extraction → `useCurrentUser` response handling
→ login mutation invalidation → consuming components). This is now fixed
and confirmed working. If auth-related bugs resurface, the same 8-step
trace structure is a good starting point — check `apps/web/.env`'s
`NEXT_PUBLIC_API_URL` first, since a mismatch between the host the browser
is on and the host the cookie was set for was a likely contributor.

## Not started yet

- i18n (Azerbaijani + English via next-intl) — deliberately deferred until
  all UI text/features stabilize
- Deploy (real domain, production env vars, updating TMDB's registered
  Application URL from `localhost` placeholder)
- Route protection beyond `/my-list` (if more protected routes get added later)

## Working style notes

- User prefers short, direct prompts for Claude Code, written by Claude
  (this chat) in English, with reference screenshots when design-relevant
- Design mockups done in-chat via the Visualizer tool before writing prompts
- User switches between Claude models depending on task complexity (Opus
  for design-heavy work, Sonnet for more mechanical/debugging tasks)
- Communicates with Claude primarily in Azerbaijani
