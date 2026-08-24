Stack & Structure
Monorepo: Turborepo + npm workspaces
apps/api — NestJS, hand-rolled JWT auth (no Passport), TypeORM, Supabase/Postgres, port 3000
apps/web — Next.js App Router, Tailwind v4 (CSS-first, no config file), shadcn/ui (on Base UI, not Radix), TanStack Query, next-intl (en/tr/ru, fully wired), port 3001
packages/shared-types (@moviex/shared-types) — ships raw .ts. apps/api may only import types from it, never values (Node can't parse the raw TS at runtime) — this is why password rules, TMDB language tags, and sort mappings are each restated by hand on the API side and documented as intentionally duplicated, not drift.
Design tokens: all --mx-* CSS variables in globals.css, never hard-coded hex in a component.
What's actually built (verified via CLAUDE.md, not just "prompted")

Auth — cookie-based, fully working, with email verification

POST /auth/signup (not /register) creates an unverified account, emails a 4-digit OTP via Nodemailer/Gmail SMTP, sets no cookie
POST /auth/verify-otp verifies + signs in in one response
POST /auth/resend-otp, 60s cooldown, no-op if already verified
POST /auth/login on an unverified account returns 403 EMAIL_NOT_VERIFIED (checked after password, so it never discloses verification state to a wrong password)
OTP policy: 4 digits, 10 min TTL, 5 attempts, 60s resend cooldown — all in apps/api/src/auth/otp.constants.ts
useCurrentUser (['auth','me']) is the single source of truth client-side; three-way gating (loading / confirmed-out / signed-in), never treats "unknown" as "logged out"
Register form field is labeled "Username" but maps to userName — the Zod schema and form state still internally call it name; this mismatch is deliberate/documented, don't "fix" it
⚠️ "Remember me" checkbox exists in the UI but is NOT wired to the backend — CLAUDE.md explicitly states sending rememberMe in the login body currently causes a 400 (forbidNonWhitelisted rejects it). This contradicts an earlier plan to make it control JWT/cookie expiry. Needs a decision: either implement it properly (extend LoginDto to accept it, vary JWT_EXPIRES_IN/cookie maxAge together) or remove the checkbox if it's not going to be functional — right now it's a dead UI element, which is worse than either alternative.

Data isolation bug — root-caused and fixed (worth reading if touching any user-owned data again)

The backend was never at fault — every user-movies query was already scoped by userId from the token
The real bug was client-side: ['user-movies'] query keys carried no user id, and logout only invalidated (not removed) the cache — so a second user in the same browser session inherited the first user's cached list
Fixed in two layers: query keys now include userId (userMoviesKey(user?.sub)), and logout calls queryClient.removeQueries() with no filter (deletes everything cached, not just marks stale)
Rule for any future user-owned feature: user id goes in the query key, and use removeQueries (not invalidateQueries) when data must become unreadable, not just stale

TMDB integration — 4 endpoints, all in apps/api/src/tmdb/

GET /tmdb/genres (24h cache, degrades to [] on failure — optional filter)
GET /tmdb/discover (no-store, throws on failure — never shows an empty grid on error)
GET /tmdb/search (q + page only, no genre/rating/sort — TMDB's search endpoint doesn't support them; stale filter params from Discover are deliberately not forwarded)
GET /tmdb/:tmdbId (1h cache, append_to_response=credits,videos — one request, not three; route declared last in the controller so it doesn't swallow genres/discover/search)
All four accept ?lang=en|tr|ru; unknown value is a 400
English-overview fallback exists for patchy TMDB translations (englishProseFor for one movie, withEnglishOverviews for a result page)

Discover page — URL-driven filters (genre, page, year range, min rating, sort — all with *\_SEARCH_PARAM + parse*Param() pairs in lib/constants/discover.ts), numbered pagination only (no load-more), grid/list view toggle, FilterPopover shared shell with draft state + edge-collision-aware positioning (flips to right-0 when it would overflow viewport — this fixed My List's sort dropdown too, since both use the same shell)

Search (/search?q=) — typeahead (debounced, keyed on the debounced value not raw input) + results page, reuses Discover's grid/list/pagination components via a shared PaginatedMoviesResponse type

Movie detail page (/movie/[tmdbId]) — trailer modal, cast, details grid, mobile-first with md: scale-up (no centered max-width container — that was tried and explicitly rejected, pages are full-bleed with edge padding only), backdrop needs both a darkening overlay AND a poster border+shadow (poster and backdrop share a color palette, dissolve into each other otherwise)

user-movies — watchlist/watched only, no rating/review. POST /user-movies is idempotent (never 409s on double-click). Snapshot fields (title/posterUrl/releaseYear/primaryGenre) denormalized on the row, sent by the client. Batch status lookup (GET /user-movies/status?tmdbIds=) avoids N requests on grid pages.

My List (/my-list) — client-side auth gating that renders in place, does not redirect (an earlier router.replace version was explicitly removed as bad UX). Three states: loading skeleton / confirmed signed-out (SignInRequired component, opens modal directly on register view for "Sign up") / signed in. Single combined query (['user-movies','list','all']), both tabs + stats + sort all derive from it client-side. Cards show hover actions (not permanent overlays), with a ⋯ menu for touch devices. Page heading uses the shared PageHeading component (28px/500 title, 13.5px description) — a convention now applied to every top-level page.

i18n — next-intl, English/Turkish/Russian, fully implemented

URL always carries the locale (localePrefix: 'always', even for English default) — deliberate, because locale is also data forwarded to TMDB as lang
Routes moved under app/[locale]/; navigation must import from @/i18n/navigation, never raw next/link/next/navigation
All UI copy in messages/{en,tr,ru}.json, 193 keys, must stay identical across all three or missing keys render error placeholders
Plurals/numbers go through ICU format, not string concatenation (Russian has 4 plural categories vs English's 2)
Auth validation messages are keys (not English) resolved client-side; Nest's raw 400 field messages are the one deliberate English-only backstop
Language switcher in navbar, native names only (English/Türkçe/Русский), preserves current path+params on switch

Error handling — error.tsx boundaries (not try/catch) at the root, /search, and /movie/[tmdbId] routes, all rendering a shared ErrorState component with a working "Try again" (reset(), not location.reload()). Distinct from empty-state components (which mean "succeeded, no results" vs error boundary's "couldn't reach the server").

LAN/mobile testing — documented gotcha: the API host must match whatever host the browser is actually on, or the SameSite=Lax session cookie is silently dropped (login still returns 200, but /auth/me 401s forever, looking like a totally broken app). lib/api.ts now warns in the dev console when the two hosts disagree.

Known open item
"Remember me" is unresolved (see above) — decide whether to implement or remove before shipping.
Not started yet
Deploy (real domain, production env vars, updating TMDB's registered Application URL from the localhost placeholder, verifying a real domain with Gmail/Resend if email volume ever needs it)
Working style notes
User prefers short, direct Claude Code prompts written by this chat in English, with reference screenshots for anything design-relevant
Design mockups done in-chat via the Visualizer tool before writing prompts
User switches models: Opus for design-heavy work, Sonnet for mechanical/ debugging work
Communicates with Claude primarily in Azerbaijani
CLAUDE.md has a strict "no Playwright/browser self-verification" rule — every prompt should include this instruction (or rely on CLAUDE.md having it, which it does)
