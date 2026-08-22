import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ACCESS_TOKEN_COOKIE } from './auth/auth.constants';

/** The web app's dev origin. Note it is 3001 — the API itself is on 3000. */
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3001';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Populates `req.cookies`, which is where JwtAuthGuard now reads the token.
  app.use(cookieParser());

  /*
   * Credentialed CORS: the browser only attaches the auth cookie to a
   * cross-origin request when the origin is echoed back exactly and
   * `credentials` is on. A wildcard origin is rejected outright in that mode,
   * so every allowed origin has to be named.
   *
   * `FRONTEND_URLS` is a comma-separated list so a phone on the LAN and the
   * dev machine's `localhost` can both be allowed at once — previously
   * switching one broke the other. `FRONTEND_URL` (singular) still works for
   * anything already configured with it.
   */
  const allowedOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    DEFAULT_FRONTEND_ORIGIN
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && allowedOrigins.length > 1) {
    // Loud, because a stray extra origin in production is a real exposure.
    logger.warn(
      `FRONTEND_URLS lists ${allowedOrigins.length} origins; production uses only the first (${allowedOrigins[0]}).`,
    );
  }

  app.enableCors({
    /*
     * Production stays a single fixed origin — the multi-origin check exists
     * for local device testing and must not loosen a deployed environment.
     */
    origin: isProduction
      ? allowedOrigins[0]
      : (origin, callback) => {
          /*
           * No `Origin` header means it is not a cross-origin browser request
           * — curl, a health check, or same-origin Swagger UI. Those were
           * never subject to CORS, so allow them through.
           */
          if (!origin) return callback(null, true);

          // `false`, not an Error: an Error surfaces as a 500, whereas this
          // just omits the header and lets the browser block it, which is
          // what a rejected origin should look like.
          callback(null, allowedOrigins.includes(origin));
        },
    credentials: true,
  });

  if (!isProduction) {
    logger.log(`CORS allows: ${allowedOrigins.join(', ')}`);
  }

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
