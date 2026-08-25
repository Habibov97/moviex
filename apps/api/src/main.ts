import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ACCESS_TOKEN_COOKIE } from './auth/auth.constants';

/**
 * Last-resort origin for local dev with no `.env` at all. Note it is 3001 —
 * the API itself is on 3000.
 *
 * It applies **only** when neither `FRONTEND_URLS` nor `FRONTEND_URL` is set;
 * a value that is present is always used, however wrong it looks.
 */
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3001';

/**
 * Reduce a configured entry or an incoming `Origin` header to its canonical
 * origin — scheme + host + non-default port, lowercased, no path, no trailing
 * slash. Returns `null` for anything that is not a usable absolute URL.
 *
 * Comparing canonical forms rather than raw strings is what makes the match
 * immune to the copy-paste artifacts that reach an env var in a dashboard:
 * a trailing slash, a wrapping pair of quotes, a stray path, or a host that
 * differs only in case. It loosens nothing — two different hosts still do not
 * match — it only stops a cosmetic difference reading as a different origin.
 */
function canonicalOrigin(value: string): string | null {
  // Dashboards happily store the quotes if a value is pasted with them.
  const cleaned = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();

  if (!cleaned) return null;

  try {
    return new URL(cleaned).origin.toLowerCase();
  } catch {
    // No scheme, or not a URL at all — `moviex-web-one.vercel.app` lands here.
    return null;
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Typed as the Express app specifically so `app.set('trust proxy', …)` below
  // is reachable — it is an Express setting, not part of `INestApplication`.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /*
   * Baseline security headers, on every response including errors — hence
   * first, before anything that can answer a request. Defaults are taken as
   * they come — verified on the wire: `X-Content-Type-Options: nosniff`,
   * `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`,
   * `Referrer-Policy: no-referrer`, `Cross-Origin-{Opener,Resource}-Policy`,
   * `X-DNS-Prefetch-Control`, `Origin-Agent-Cluster`, the `X-Powered-By`
   * removal, and the rest.
   *
   * `Cross-Origin-Resource-Policy: same-origin` does not break the frontend:
   * it is enforced against `no-cors` subresource loads, not against the
   * credentialed CORS `fetch` every call from the web app makes. Posters are
   * loaded straight from `image.tmdb.org`, not proxied through here, so
   * nothing on this origin is fetched as a bare subresource.
   *
   * `contentSecurityPolicy` is the one default turned off, and it is a
   * considered exception rather than a shortcut:
   *
   *   - This is a JSON API. CSP governs what an HTML *document* may load, so
   *     for every route the frontend actually calls it constrains nothing —
   *     the protection lives in the browser rendering the Next app, which
   *     ships its own headers from its own origin.
   *   - The only HTML served here is Swagger UI at `/docs`, and `@nestjs/swagger`
   *     bootstraps it with an **inline** `<script>`. Helmet's default policy is
   *     `script-src 'self'`, which blocks exactly that, and `/docs` renders
   *     blank — a page this project relies on for manual testing.
   *
   * The two ways out would be `'unsafe-inline'` in `script-src`, which is the
   * same as no policy while looking like one, or a hand-tuned per-route CSP,
   * which is a real piece of work and easy to get subtly wrong. Off, documented,
   * is the honest option. If HTML that matters is ever served from this origin,
   * that is the moment to write a policy — not before.
   */
  app.use(helmet({ contentSecurityPolicy: false }));

  /*
   * Rate limiting tracks `req.ip`, which Express derives from the socket unless
   * it is told a proxy sits in front. Deployed behind a load balancer or a
   * platform router without this, every request carries the proxy's address:
   * one bucket for the entire internet, and the first busy visitor locks
   * everyone else out of `/auth/login`.
   *
   * Off by default, because trusting `X-Forwarded-For` when nothing is actually
   * rewriting it is the opposite failure — a client can then forge a fresh
   * address per request and the limits stop meaning anything. Set it only where
   * a proxy really is in front: `TRUST_PROXY=1` for a single hop (the common
   * case), or a comma-separated list of trusted addresses/subnets.
   */
  const trustProxy = process.env.TRUST_PROXY?.trim();

  if (trustProxy) {
    const hops = Number(trustProxy);

    app.set('trust proxy', Number.isInteger(hops) ? hops : trustProxy);
    logger.log(`Trusting proxy: ${trustProxy}`);
  }

  // Populates `req.cookies`, which is where JwtAuthGuard now reads the token.
  app.use(cookieParser());

  /*
   * Credentialed CORS: the browser only attaches the auth cookie to a
   * cross-origin request when the origin is echoed back exactly and
   * `credentials` is on. A wildcard origin is rejected outright in that mode,
   * so every allowed origin has to be named.
   *
   * `FRONTEND_URLS` is a comma-separated list so several origins can be
   * allowed at once — the deployed frontend plus a phone on the LAN plus the
   * dev machine's `localhost`. `FRONTEND_URL` (singular) still works for
   * anything already configured with it.
   */
  const configuredOrigins =
    process.env.FRONTEND_URLS?.trim() || process.env.FRONTEND_URL?.trim() || '';

  /*
   * The fallback applies only when the value is genuinely absent — local dev
   * with no `.env` at all. Note `||` rather than `??`: an env var that is
   * present but *empty* is a misconfiguration, not a value, and `??` would
   * accept it and leave the allow-list empty.
   */
  const usingDefaultOrigin = configuredOrigins === '';

  const allowedOrigins = (
    usingDefaultOrigin ? DEFAULT_FRONTEND_ORIGIN : configuredOrigins
  )
    .split(',')
    // A browser's `Origin` is scheme + host [+ port] and never carries a
    // trailing slash, so a pasted `https://example.com/` would silently match
    // nothing. Normalise it rather than making that a deployment puzzle.
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === 'production';

  // The list the allow/deny decision is actually made against.
  const allowedCanonical = new Set(
    allowedOrigins
      .map(canonicalOrigin)
      .filter((origin): origin is string => origin !== null),
  );

  /*
   * Logged in every environment, production included. This was once wrapped in
   * `if (!isProduction)`, which is precisely why a misconfigured deployment
   * gave no signal at all and cost a long debugging pass — production is where
   * the origin list is hardest to see, not easiest.
   */
  logger.log(`CORS allows: ${[...allowedCanonical].join(', ') || '(nothing)'}`);

  for (const origin of allowedOrigins) {
    if (canonicalOrigin(origin) === null) {
      logger.error(
        `FRONTEND_URLS entry "${origin}" is not an absolute URL (missing http(s):// ?) — dropped; it can never match a browser Origin.`,
      );
    }
  }

  if (isProduction && usingDefaultOrigin) {
    logger.warn(
      `No FRONTEND_URLS set in production; CORS allows only ${DEFAULT_FRONTEND_ORIGIN}, so no deployed frontend can call this API.`,
    );
  }

  app.enableCors({
    /*
     * One validation function in every environment, matching the request's
     * own `Origin` against the parsed list.
     *
     * Production used to pin to `allowedOrigins[0]` — a *static* origin,
     * which the `cors` package echoes back regardless of who asked. That is
     * what let a deployment answer a request from the Vercel frontend with
     * `Access-Control-Allow-Origin: http://localhost:3001`: an origin the
     * caller never sent, asserted as though it had. A function can only ever
     * echo the caller's own origin or send no header at all, so a
     * misconfigured list now fails as "not allowed" instead of as a
     * confusing mismatch — and several origins (a deployed frontend plus
     * preview URLs plus localhost) can be allowed at once.
     *
     * Matching is on canonical origins, so a trailing slash or a pasted pair
     * of quotes in the env var cannot read as a different origin.
     */
    origin: (origin, callback) => {
      /*
       * No `Origin` header means it is not a cross-origin browser request —
       * curl, a health check, or same-origin Swagger UI. Those were never
       * subject to CORS, so allow them through.
       */
      if (!origin) return callback(null, true);

      const requestCanonical = canonicalOrigin(origin);
      const isAllowed =
        requestCanonical !== null && allowedCanonical.has(requestCanonical);

      // `false`, not an Error: an Error surfaces as a 500, whereas this just
      // omits the header and lets the browser block it, which is what a
      // rejected origin should look like.
      callback(null, isAllowed);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('MovieX example')
    .setDescription(
      'This is Movie app which you can perform some actions in it',
    )
    .setVersion('1.0')
    .addTag('movies')
    .addTag('tmdb', 'Public catalogue data proxied from TMDB')
    .addTag('user-movies', "The signed-in user's saved movies")
    /*
     * Auth is a httpOnly cookie, not an Authorization header, so there is no
     * token for a user to paste into an "Authorize" box — the browser attaches
     * it automatically. Declaring it as an apiKey-in-cookie scheme keeps the
     * generated docs honest about how a request is authenticated.
     *
     * Swagger UI is served from this same origin, so `POST /auth/login` from
     * the docs page sets the cookie and every later "Try it out" call carries
     * it with no further setup.
     */
    .addCookieAuth(
      ACCESS_TOKEN_COOKIE,
      {
        type: 'apiKey',
        in: 'cookie',
        name: ACCESS_TOKEN_COOKIE,
      },
      'access-token',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
