import { ApiProperty } from '@nestjs/swagger';
import type { Genre } from '@moviex/shared-types';

/**
 * Swagger's response schema for a genre.
 *
 * `@nestjs/swagger` reflects over classes, not TS types, so the shared `Genre`
 * type cannot be handed to `@ApiResponse` directly. `implements Genre` ties the
 * two together — if the shared type changes, this stops compiling instead of
 * silently documenting a stale shape.
 */
export class GenreDto implements Genre {
  @ApiProperty({
    example: 28,
    description:
      "TMDB's genre id. Pass this straight through as the `with_genres` filter value.",
  })
  id!: number;

  @ApiProperty({ example: 'Action' })
  name!: string;
}
