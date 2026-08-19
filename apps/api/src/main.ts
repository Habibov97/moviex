import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ACCESS_TOKEN_COOKIE } from './auth/auth.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Populates `req.cookies`, which is where JwtAuthGuard now reads the token.
  app.use(cookieParser());

  /*
   * Credentialed CORS: the browser only attaches the auth cookie to a
   * cross-origin request when the origin is echoed back exactly and
   * `credentials` is on. A wildcard origin is rejected outright in that mode,
   * so this must stay an explicit origin.
   */
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
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
