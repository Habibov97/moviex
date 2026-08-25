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
 * next-intl is basePath-aware: it reads `request.nextUrl.basePath` and re-adds
 * the prefix to every redirect and rewrite it produces, and scopes the
 * `NEXT_LOCALE` cookie's `path` to it. Nothing here has to do that by hand.
 *
 * It is **not** an auth guard — `/my-list` still protects itself client-side
 * via `useCurrentUser`, because the session lives in an httpOnly cookie the
 * page reads at render time. See the My List notes in CLAUDE.md.
 */
export default createMiddleware(routing);

export const config = {
  /*
   * Matcher sources are written **relative to the basePath** — Next prepends
   * `basePath` to each one before compiling it (verified against this version's
   * `getMiddlewareMatchers`, which does `source = \`${basePath}${source}\``).
   *
   * Hence two entries, not one:
   *
   * 1. `'/'` — the root of the basePath. Without it, `/moviex` (no trailing
   *    slash) matches nothing: the pattern below compiles to
   *    `^/moviex(?:/…)?(?:/(…))…$`, which needs the separator, and Next's own
   *    `trailingSlash: false` redirect has already turned `/moviex/` into
   *    `/moviex`. The result is that the site's front door skips next-intl
   *    entirely and 404s instead of redirecting to `/moviex/en`. Measured, not
   *    guessed — this entry is the difference between MATCH and skip on
   *    `/moviex`. next-intl documents the same requirement for base paths.
   * 2. Everything else except Next's internals, the API proxy, and files with
   *    an extension. `_vercel` covers deployment probes; the extension test is
   *    what keeps `favicon.ico` and the fonts from being redirected into a
   *    locale that does not serve them.
   *
   * `api` staying in the exclusion list is load-bearing now rather than
   * cosmetic: it is what keeps `/moviex/api/*` out of next-intl's hands so the
   * `rewrites()` proxy in `next.config.js` gets it. Without it every API call
   * would be redirected to `/moviex/en/api/…`.
   */
  matcher: ['/', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
