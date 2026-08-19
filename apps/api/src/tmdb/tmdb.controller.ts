import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { DiscoverMoviesResponse, Genre } from '@moviex/shared-types';
import { TmdbService } from './tmdb.service';
import { GenreDto } from './dto/genre.dto';
import { DiscoverMoviesResponseDto } from './dto/movie-summary.dto';
import { DiscoverQueryDto, TMDB_SORT_OPTIONS } from './dto/discover-query.dto';

@ApiTags('tmdb')
@Controller('tmdb')
export class TmdbController {
  constructor(private readonly tmdbService: TmdbService) {}

  /** Public — genre names are catalogue data, not user data, so no guard. */
  @Get('genres')
  @ApiOperation({
    summary: 'List movie genres',
    description:
      "Proxies TMDB's `/genre/movie/list` and returns the `genres` array " +
      'unchanged. `id` is TMDB\'s own genre id, usable directly as the ' +
      '`with_genres` filter value. Public — no authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'The full genre list, in TMDB order.',
    type: [GenreDto],
  })
  @ApiResponse({
    status: 500,
    description: 'TMDB_API_KEY is not configured on the server.',
  })
  @ApiResponse({
    status: 503,
    description: 'TMDB was unreachable or returned an error.',
  })
  getGenres(): Promise<Genre[]> {
    return this.tmdbService.getGenres();
  }

  /** Public — same as genres: catalogue data, no guard. */
  @Get('discover')
  @ApiOperation({
    summary: 'Discover movies',
    description:
      "Proxies TMDB's `/discover/movie` and normalises each result into " +
      '`MovieSummary` — `poster_path` is expanded to a full image URL (or ' +
      '`null` when TMDB has no artwork) and `release_date` is reduced to a ' +
      'four-digit year. Public — no authentication required.',
  })
  @ApiQuery({
    name: 'genre',
    required: false,
    type: Number,
    example: 28,
    description:
      'TMDB genre id, from `GET /tmdb/genres`. Omit for no genre filter.',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: TMDB_SORT_OPTIONS,
    description: "TMDB `sort_by` value. Defaults to `popularity.desc`.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: '1-based page number. Defaults to 1.',
  })
  @ApiResponse({
    status: 200,
    description: 'A page of discover results.',
    type: DiscoverMoviesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'An unsupported `sort` value or a non-numeric genre/page.',
  })
  @ApiResponse({
    status: 500,
    description: 'TMDB_API_KEY is not configured on the server.',
  })
  @ApiResponse({
    status: 503,
    description: 'TMDB was unreachable or returned an error.',
  })
  discoverMovies(
    @Query() query: DiscoverQueryDto,
  ): Promise<DiscoverMoviesResponse> {
    return this.tmdbService.discoverMovies({
      genreId: query.genre,
      sortBy: query.sort,
      page: query.page,
    });
  }
}
