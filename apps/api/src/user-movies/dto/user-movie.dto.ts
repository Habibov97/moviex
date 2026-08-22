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

  @ApiPropertyOptional({ example: 'Science Fiction', nullable: true })
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
  @ApiProperty({ nullable: true, example: 'Science Fiction' })
  primaryGenre!: string | null;
  @ApiProperty({ nullable: true }) watchedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class UserMovieStatusEntryDto {
  @ApiProperty({ example: 693134 }) tmdbId!: number;
  @ApiProperty({ enum: UserMovieStatusEnum }) status!: UserMovieStatusEnum;
}
