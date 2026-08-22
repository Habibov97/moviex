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
   * Everything except Next's internals and files with an extension. `_vercel`
   * covers deployment probes; the extension test is what keeps `favicon.ico`
   * and the fonts from being redirected into a locale that does not serve them.
   */
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
