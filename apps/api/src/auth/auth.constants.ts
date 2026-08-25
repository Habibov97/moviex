import type { CookieOptions } from 'express';

/**
 * Name of the httpOnly cookie carrying the access token.
 *
 * Referenced by the controller (set/clear), the guard (read) and the Swagger
 * cookie scheme in `main.ts`, so it is defined once — a typo in any one of
 * those would silently produce a request that never authenticates.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Cookie attributes shared by the set (login, signup) and clear
 * (logout) calls. They must match on `path` — and on every other attribute —
 * or the browser treats logout's cookie as a different one and leaves the
 * original in place.
 *
 * **`sameSite` is `lax` in every environment, and the reason it can be is the
 * Vercel proxy.** The browser only ever talks to the frontend's own origin:
 * `habiboff.cc/moviex/api/*` is rewritten server-side by Next to
 * `moviex-skr4.onrender.com/*` (see `rewrites()` in `apps/web/next.config.js`),
 * so this cookie is set and sent on requests the browser considers same-site.
 * `lax` is the stricter, safer default and restores the CSRF protection that
 * `none` had given up.
 *
 * **This deliberately reverses the previous `sameSite: 'none'` in production**,
 * and the history is worth keeping. Deployed directly, the frontend and the API
 * were on genuinely different sites (`*.vercel.app` and `*.onrender.com`), so
 * every call was cross-site and `lax` meant the browser *stored* the cookie and
 * then declined to attach it to `fetch()` — `POST /auth/login` returning 200
 * with a `Set-Cookie` DevTools happily showed, followed by `GET /auth/me`
 * 401ing with no cookie at all. `none` fixed that on Chrome and Firefox, and
 * then failed anyway on mobile Safari/WebKit, which blocks third-party cookies
 * outright no matter what the attributes say. Proxying is what actually removed
 * the cross-site request rather than negotiating with it.
 *
 * **So: do not put `none` back without also removing the proxy.** If the two
 * halves are ever served from different sites again, `none` + `secure` is
 * required — and `none` is only honoured together with `Secure`, which is why
 * that pair would have to move together.
 *
 * `secure` still follows the environment on its own: HTTPS in production,
 * plain HTTP in local dev where `Secure` would drop the cookie entirely.
 * `localhost:3001` → `localhost:3000` is same-site too, so `lax` is right there
 * for the same reason it is right in production.
 */
const isProduction = () => process.env.NODE_ENV === 'production';

export const accessTokenCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction(),
  /*
   * Constant, not environment-dependent — every request that carries this
   * cookie is same-site now, in dev and in production alike. See above before
   * changing it.
   */
  sameSite: 'lax',
  /*
   * Root, not the frontend's `/moviex` base path. The API is a separate origin
   * server-side and knows nothing about where Vercel mounts the app; `/` is
   * also what Swagger UI at `<api-host>/docs` needs, since that page is served
   * from this origin directly.
   */
  path: '/',
});
