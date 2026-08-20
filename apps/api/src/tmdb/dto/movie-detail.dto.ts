import { ApiProperty } from '@nestjs/swagger';
import type {
  CastMember,
  Genre,
  MovieDetail,
  MovieTrailer,
} from '@moviex/shared-types';

import { GenreDto } from './genre.dto';

class CastMemberDto implements CastMember {
  @ApiProperty({ example: 1190668 }) id!: number;
  @ApiProperty({ example: 'Timothée Chalamet' }) name!: string;
  @ApiProperty({ example: 'Paul Atreides' }) character!: string;
  @ApiProperty({ nullable: true, example: 'https://image.tmdb.org/t/p/w500/x.jpg' })
  profileUrl!: string | null;
}

class MovieTrailerDto implements MovieTrailer {
  @ApiProperty({ example: 'Way9Dexny3w', description: 'YouTube video id.' })
  key!: string;
  @ApiProperty({ example: 'Official Trailer' }) name!: string;
}

/**
 * Swagger schema for the detail response. `implements MovieDetail` ties it to
 * the shared type, so a change there fails to compile rather than silently
 * documenting a stale shape.
 */
export class MovieDetailDto implements MovieDetail {
  @ApiProperty({ example: 693134 }) tmdbId!: number;
  @ApiProperty({ example: 'Dune: Part Two' }) title!: string;
  @ApiProperty({ example: 'Dune: Part Two' }) originalTitle!: string;
  @ApiProperty({ nullable: true, example: 'Long live the fighters.' })
  tagline!: string | null;
  @ApiProperty({ nullable: true }) overview!: string | null;
  @ApiProperty({ nullable: true }) posterUrl!: string | null;
  @ApiProperty({ nullable: true, description: 'Wider w1280 rendition.' })
  backdropUrl!: string | null;
  @ApiProperty({ nullable: true, example: 8.1, description: '`null` when unrated (including vote_count 0).' })
  rating!: number | null;
  @ApiProperty({ nullable: true, example: 6204 }) voteCount!: number | null;
  @ApiProperty({ nullable: true, example: '2024-02-27' })
  releaseDate!: string | null;
  @ApiProperty({ nullable: true, example: '2024' }) releaseYear!: string | null;
  @ApiProperty({ nullable: true, example: 166, description: 'Minutes.' })
  runtime!: number | null;
  @ApiProperty({ nullable: true, example: 'en' })
  originalLanguage!: string | null;
  @ApiProperty({ nullable: true, example: 'Released' }) status!: string | null;
  @ApiProperty({ type: [GenreDto] }) genres!: Genre[];
  @ApiProperty({ type: [CastMemberDto] }) cast!: CastMember[];
  @ApiProperty({ type: [String], example: ['Denis Villeneuve'] })
  directors!: string[];
  @ApiProperty({ type: MovieTrailerDto, nullable: true })
  trailer!: MovieTrailer | null;
}
