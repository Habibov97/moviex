import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserMovieEntity } from 'src/entity/user-movie.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UserMoviesController } from './user-movies.controller';
import { UserMoviesService } from './user-movies.service';

@Module({
  // AuthModule exports JwtAuthGuard, which every route here is behind.
  imports: [TypeOrmModule.forFeature([UserMovieEntity]), AuthModule],
  controllers: [UserMoviesController],
  providers: [UserMoviesService],
  exports: [UserMoviesService],
})
export class UserMoviesModule {}
