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
 * Cookie attributes shared by the set (login) and clear (logout) calls. They
 * must match on `path` — and on the rest of the attributes — or the browser
 * treats logout's cookie as a different one and leaves the original in place.
 *
 * `sameSite: 'lax'` keeps the cookie on top-level navigations back to the app
 * while still blocking it on cross-site subrequests. Note that a genuinely
 * cross-site frontend would need `sameSite: 'none'` plus `secure`, which is why
 * `secure` follows NODE_ENV rather than being hard-coded off.
 */
export const accessTokenCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});
