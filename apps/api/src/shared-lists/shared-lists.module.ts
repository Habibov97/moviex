import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from 'src/entity/user.entity';
import { UserMovieEntity } from 'src/entity/user-movie.entity';
import { AuthModule } from 'src/auth/auth.module';
import {
  ListShareController,
  SharedListsController,
} from './shared-lists.controller';
import { SharedListsService } from './shared-lists.service';

@Module({
  // AuthModule exports JwtAuthGuard, which the owner-side routes sit behind.
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserMovieEntity]),
    AuthModule,
  ],
  controllers: [ListShareController, SharedListsController],
  providers: [SharedListsService],
})
export class SharedListsModule {}
