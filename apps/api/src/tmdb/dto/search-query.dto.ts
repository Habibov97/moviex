import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

import { TMDB_MAX_PAGE } from './discover-query.dto';

export class SearchQueryDto {
  /**
   * Required. `@IsNotEmpty` rejects `?q=` and `?q=%20` here rather than letting
   * an empty query reach TMDB, which answers it with a 422.
   */
  @IsString()
  @IsNotEmpty()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TMDB_MAX_PAGE)
  page?: number;
}
