import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

import { UserMovieStatusEnum } from 'src/entity/user-movie.entity';

/** `POST /user-movies` — create or upsert the caller's entry for a movie. */
export class AddUserMovieDto {
  @ApiProperty({ example: 693134, description: "TMDB's movie id." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tmdbId!: number;

  @ApiPropertyOptional({
    enum: UserMovieStatusEnum,
    default: UserMovieStatusEnum.WATCHLIST,
    description: 'Defaults to `watchlist` when omitted.',
  })
  @IsOptional()
  @IsEnum(UserMovieStatusEnum)
  status?: UserMovieStatusEnum;

  /*
   * Snapshot fields — see the entity for why they are stored rather than
   * re-fetched. The client always has them from the card it acted on.
   */
  @ApiProperty({ example: 'Dune: Part Two' })
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  posterUrl?: string | null;

  @ApiPropertyOptional({ example: '2024', nullable: true })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  releaseYear?: string | null;

  /**
   * TMDB genre id of the movie's first genre. Locale-independent on purpose —
   * My List resolves it to a name at render time so the "top genre" stat
   * follows the language switcher.
   */
  @ApiPropertyOptional({
    example: 878,
    nullable: true,
    description:
      "TMDB genre id of the movie's primary genre. Stored as an id, not a " +
      'name, so the displayed genre is resolved in the reader’s language ' +
      'rather than frozen in the saver’s.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  primaryGenreId?: number | null;

  /**
   * @deprecated Superseded by `primaryGenreId`. Still accepted rather than
   * removed: the API's global `forbidNonWhitelisted` turns an unknown property
   * into a 400, so dropping it here would reject an older client outright. It
   * is stored, but nothing reads it.
   */
  @ApiPropertyOptional({
    example: 'Science Fiction',
    nullable: true,
    deprecated: true,
    description: 'Legacy resolved genre name. Ignored — send primaryGenreId.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  primaryGenre?: string | null;
}

/** `PATCH /user-movies/:tmdbId`. */
export class UpdateUserMovieStatusDto {
  @ApiProperty({ enum: UserMovieStatusEnum })
  @IsEnum(UserMovieStatusEnum)
  status!: UserMovieStatusEnum;
}

/** `GET /user-movies?status=…` */
export class ListUserMoviesQueryDto {
  @ApiPropertyOptional({ enum: UserMovieStatusEnum })
  @IsOptional()
  @IsEnum(UserMovieStatusEnum)
  status?: UserMovieStatusEnum;
}

/** `GET /user-movies/status?tmdbIds=1,2,3` */
export class MovieStatusQueryDto {
  @ApiProperty({
    example: '693134,335984',
    description: 'Comma-separated TMDB ids.',
  })
  @IsString()
  tmdbIds!: string;
}

export class UserMovieResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 693134 }) tmdbId!: number;
  @ApiProperty({ enum: UserMovieStatusEnum }) status!: UserMovieStatusEnum;
  @ApiProperty({ example: 'Dune: Part Two' }) title!: string;
  @ApiProperty({ nullable: true }) posterUrl!: string | null;
  @ApiProperty({ nullable: true, example: '2024' }) releaseYear!: string | null;
  @ApiProperty({ nullable: true, example: 878 })
  primaryGenreId!: number | null;
  /** @deprecated Legacy name snapshot — resolve `primaryGenreId` instead. */
  @ApiProperty({ nullable: true, example: 'Science Fiction', deprecated: true })
  primaryGenre!: string | null;
  @ApiProperty({ nullable: true }) watchedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class UserMovieStatusEntryDto {
  @ApiProperty({ example: 693134 }) tmdbId!: number;
  @ApiProperty({ enum: UserMovieStatusEnum }) status!: UserMovieStatusEnum;
}
