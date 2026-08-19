import { ApiProperty } from '@nestjs/swagger';
import type {
  DiscoverMoviesResponse,
  MovieSummary,
  MovieUserState,
} from '@moviex/shared-types';

/**
 * Swagger schema for a discover result. As with `GenreDto`, `implements` ties it
 * to the shared type so the docs cannot drift from what is actually returned.
 */
export class MovieSummaryDto implements MovieSummary {
  @ApiProperty({ example: 1061474, description: "TMDB's movie id." })
  tmdbId!: number;

  @ApiProperty({ example: 'Superman' })
  title!: string;

  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/w500/ombsmhYUqR4qqOLOxAyr5V8hbyv.jpg',
    nullable: true,
    description: 'Full URL, already expanded. `null` when TMDB has no artwork.',
  })
  posterUrl!: string | null;

  @ApiProperty({ example: 7.4, description: "TMDB's vote_average, 0–10." })
  rating!: number;

  @ApiProperty({
    example: '2025',
    nullable: true,
    description: 'Four-digit year. `null` when TMDB has no release date.',
  })
  releaseYear!: string | null;

  @ApiProperty({ example: [878, 12], type: [Number] })
  genreIds!: number[];

  @ApiProperty({ example: 'A reporter...', nullable: true })
  overview!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: ['watched', 'listed'],
    description:
      "Not from TMDB — set once a signed-in user's list is joined onto results.",
  })
  userState?: MovieUserState | null;
}

export class DiscoverMoviesResponseDto implements DiscoverMoviesResponse {
  @ApiProperty({ type: [MovieSummaryDto] })
  results!: MovieSummaryDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 500 })
  totalPages!: number;

  @ApiProperty({ example: 10000 })
  totalResults!: number;
}
