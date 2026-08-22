import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TmdbModule } from './tmdb/tmdb.module';
import { UserMoviesModule } from './user-movies/user-movies.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configs from './config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
    }),
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
  providers: [AppService],
})
export class AppModule {}
