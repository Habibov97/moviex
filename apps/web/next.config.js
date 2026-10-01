import createNextIntlPlugin from "next-intl/plugin";

/**
 * Points next-intl at `i18n/request.ts` (its default location, passed
 * explicitly so the wiring is visible here rather than implied).
 */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * Where `/api/*` is proxied to — the real NestJS API on Render.
 *
 * Read from `API_URL` (Next loads `.env` *before* evaluating this file) so the
 * proxy target and the Server Components' direct fetch target are the same
 * value, and so the proxy path can be exercised locally against
 * `http://localhost:3000` rather than only ever in production. The literal is
 * the last-resort default for a deployment where the variable never landed.
 */
const API_PROXY_TARGET = (
  process.env.API_URL?.trim() || "https://moviex-skr4.onrender.com"
).replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * No `basePath`. The app is served from the root of its own subdomain,
   * `moviex.habiboff.cc`, so `/en`, `/api/*` and `/_next/*` are all literal
   * paths. It used to be mounted at `habiboff.cc/moviex` with
   * `basePath: '/moviex'`; routes were always written prefix-free, so dropping
   * it needed no change to any `Link`, `router.push` or `redirect()`.
   */
  // `@moviex/shared-types` ships raw TS source (see its package.json `exports`),
  // so Next has to compile it alongside the app.
  transpilePackages: ["@moviex/shared-types"],
  images: {
    // Posters are absolute TMDB URLs built in `TmdbService.toMovieSummary`;
    // next/image refuses any remote host not listed here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  /**
   * Same-origin proxy to the API.
   *
   * The browser calls `https://moviex.habiboff.cc/api/auth/login`; Vercel
   * forwards it server-to-server to `https://moviex-skr4.onrender.com/auth/login`
   * and pipes the response — `Set-Cookie` included — straight back. The Render
   * host is never named in anything the browser sees, so the session cookie is
   * stored against `moviex.habiboff.cc` and every later call to it is
   * **same-site**.
   *
   * That is the whole point: it is what let the API's cookie go back to
   * `SameSite=Lax` (see `apps/api/src/auth/auth.constants.ts`) and what fixes
   * mobile Safari/WebKit, which blocks third-party cookies outright and so
   * refused to keep the old cross-site `SameSite=None` session at all.
   *
   * `/api` is reserved for this proxy: `proxy.ts` excludes it from next-intl's
   * matcher, so it is never redirected into a locale.
   *
   * Returned as a plain array, i.e. `afterFiles`: checked after static files
   * but **before** dynamic routes, so `app/[locale]` can never swallow it.
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
