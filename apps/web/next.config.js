import createNextIntlPlugin from "next-intl/plugin";

/**
 * Points next-intl at `i18n/request.ts` (its default location, passed
 * explicitly so the wiring is visible here rather than implied).
 */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * The sub-path the whole app is served under: `habiboff.cc/moviex`, leaving the
 * root of the domain free for a separate personal site later.
 *
 * Next applies it automatically to `next/link` hrefs, `router.push`, server
 * `redirect()`, `_next/*` assets and the `app/` icon file conventions, so no
 * route in the app is written with the prefix — `<Link href="/my-list">` still
 * renders `/moviex/tr/my-list`. Two places do *not* get it for free and are
 * handled below: the middleware matcher and `rewrites()`.
 *
 * **Build-time constant.** Next inlines it into the client bundle, so changing
 * it requires a rebuild, not just a restart.
 */
const BASE_PATH = "/moviex";

/**
 * Where `/moviex/api/*` is proxied to — the real NestJS API on Render.
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
  basePath: BASE_PATH,
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
   * The browser calls `https://habiboff.cc/moviex/api/auth/login`; Vercel
   * forwards it server-to-server to `https://moviex-skr4.onrender.com/auth/login`
   * and pipes the response — `Set-Cookie` included — straight back. The Render
   * host is never named in anything the browser sees, so the session cookie is
   * stored against `habiboff.cc` and every later call to it is **same-site**.
   *
   * That is the whole point: it is what let the API's cookie go back to
   * `SameSite=Lax` (see `apps/api/src/auth/auth.constants.ts`) and what fixes
   * mobile Safari/WebKit, which blocks third-party cookies outright and so
   * refused to keep the old cross-site `SameSite=None` session at all.
   *
   * **`source` is written without the basePath and `destination` keeps none.**
   * Verified against this Next version's `load-custom-routes.js` rather than
   * assumed: `srcBasePath` is prepended to every `source`, while `destination`
   * is only prefixed when it starts with `/` (i.e. is internal). So this
   * matches `/moviex/api/:path*`, and writing that literally here would produce
   * `/moviex/moviex/api/:path*`. Do not add `basePath: false` either — that
   * would stop the basePath being included *when matching*, so the rule would
   * only fire for a bare `/api/*` the app never requests.
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
