import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/**
 * Locale detection and redirection.
 *
 * Named `proxy.ts`, not `middleware.ts`: Next 16 deprecated the old filename
 * and warns on every build. The contract is unchanged — a default-exported
 * `(NextRequest) => NextResponse` plus a `matcher` — so next-intl's
 * `createMiddleware` output drops straight in.
 *
 * With `localePrefix: 'always'` this is what turns a bare `/my-list` into
 * `/en/my-list` (or the visitor's detected language), so no route in the app
 * has to cope with a missing prefix.
 *
 * It is **not** an auth guard — `/my-list` still protects itself client-side
 * via `useCurrentUser`, because the session lives in an httpOnly cookie the
 * page reads at render time. See the My List notes in CLAUDE.md.
 */
export default createMiddleware(routing);

export const config = {
  /*
   * Everything except Next's internals, the API proxy, and files with an
   * extension. `_vercel` covers deployment probes; the extension test is what
   * keeps `favicon.ico` and the fonts from being redirected into a locale that
   * does not serve them. This is the shape next-intl documents for an app with
   * no `basePath`.
   *
   * **One entry covers the front door.** `.*` may be empty, so `/` matches and
   * is redirected to `/en` (or the detected language). Checked against this
   * Next version's `getMiddlewareMatchers`: `/`, `/en`, `/tr/my-list` and a
   * bare `/my-list` all MATCH; `/api`, `/api/auth/login`, `/_next/…`,
   * `/_vercel/…` and `/favicon.ico` skip. An explicit `'/'` entry used to sit
   * beside it, and was required only while the app lived under
   * `basePath: '/moviex'` — the compiled pattern then needed a separator after
   * `/moviex`, so the bare base path matched nothing and 404'd. If a base path
   * is ever reintroduced, that entry has to come back with it.
   *
   * `api` in the exclusion list is load-bearing: it is what keeps `/api/*` out
   * of next-intl's hands so the `rewrites()` proxy in `next.config.js` gets it.
   * Without it every API call would be redirected to `/en/api/…`.
   */
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
