import { Module } from '@nestjs/common';
import { TmdbController } from './tmdb.controller';
import { TmdbService } from './tmdb.service';

@Module({
  controllers: [TmdbController],
  providers: [TmdbService],
  // Exported so future feature modules (discover, search) can reuse the client
  // rather than each calling TMDB directly.
  exports: [TmdbService],
})
export class TmdbModule {}
