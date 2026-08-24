import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TmdbModule } from './tmdb/tmdb.module';
import { UserMoviesModule } from './user-movies/user-movies.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configs from './config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DEFAULT_LIMIT, THROTTLE_WINDOW_MS } from './throttle.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
    }),
    /*
     * One unnamed throttler, so it registers under the name `default` — that is
     * the name `@Throttle({ default: … })` on a controller method overrides, and
     * it is why the strict auth limits need no second registration here.
     *
     * Storage is the in-memory default: counters live in this process and reset
     * on restart. Fine for a single instance; running more than one would give
     * each its own counters and multiply every limit by the instance count, at
     * which point this needs a shared store (`ThrottlerStorageRedisService`).
     */
    ThrottlerModule.forRoot([
      { ttl: THROTTLE_WINDOW_MS, limit: DEFAULT_LIMIT },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),

        autoLoadEntities: true,
        // synchronize: true,
      }),
    }),

    AuthModule,
    TmdbModule,
    UserMoviesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    /*
     * Global, so a route added later is limited by default rather than by
     * remembering to decorate it. It runs alongside `JwtAuthGuard` rather than
     * instead of it — the two answer different questions, and rate limiting has
     * to apply to unauthenticated requests most of all.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
