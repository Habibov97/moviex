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
 * **`sameSite` follows the environment, and in production it must be `none`.**
 * Deployed, the frontend and the API are on genuinely different sites
 * (`*.vercel.app` and `*.onrender.com`), so every call from the app is a
 * cross-site request. Under `sameSite: 'lax'` the browser *stores* the cookie
 * and simply declines to attach it to `fetch()` — only top-level navigations
 * carry it. That failure is unusually confusing: `POST /auth/login` returns
 * 200 with a `Set-Cookie` the DevTools cookie jar shows, and the very next
 * `GET /auth/me` still 401s with no cookie at all.
 *
 * `none` is only honoured together with `Secure`, which is why the two are
 * driven by the same flag rather than set independently — a `SameSite=None`
 * cookie without `Secure` is rejected outright by every current browser, which
 * would turn a working `lax` setup into no cookie whatsoever.
 *
 * Development stays `lax` + insecure on purpose: `localhost:3001` →
 * `localhost:3000` is *same-site* (one registrable domain), so `lax` is both
 * sufficient and stricter, and `Secure` would drop the cookie over plain HTTP.
 */
const isProduction = () => process.env.NODE_ENV === 'production';

export const accessTokenCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  // Same source for both: `none` without `secure` is discarded by the browser.
  secure: isProduction(),
  sameSite: isProduction() ? 'none' : 'lax',
  path: '/',
});
