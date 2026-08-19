import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * TMDB refuses any page above this with a 400, which would otherwise surface
 * here as a misleading "TMDB unavailable" 503. Bounded so it fails as a clear
 * client error instead.
 */
export const TMDB_MAX_PAGE = 500;

/**
 * TMDB's supported `sort_by` values. Whitelisted rather than passed through, so
 * a bad value fails here as a 400 instead of surfacing as a TMDB 503.
 */
export const TMDB_SORT_OPTIONS = [
  'popularity.desc',
  'popularity.asc',
  'vote_average.desc',
  'vote_average.asc',
  'primary_release_date.desc',
  'primary_release_date.asc',
  'title.asc',
  'title.desc',
  'revenue.desc',
  'revenue.asc',
] as const;

export class DiscoverQueryDto {
  /** TMDB genre id. Omitted means no genre filter. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genre?: number;

  @IsOptional()
  @IsIn(TMDB_SORT_OPTIONS as unknown as string[])
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TMDB_MAX_PAGE)
  page?: number;
}
