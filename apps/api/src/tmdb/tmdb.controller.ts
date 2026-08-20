import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  Genre,
  MovieDetail,
  PaginatedMoviesResponse,
} from '@moviex/shared-types';
import { TmdbService } from './tmdb.service';
import { GenreDto } from './dto/genre.dto';
import { DiscoverMoviesResponseDto } from './dto/movie-summary.dto';
import { DiscoverQueryDto, TMDB_SORT_OPTIONS } from './dto/discover-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { MovieDetailDto } from './dto/movie-detail.dto';

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
  @ApiQuery({
    name: 'yearFrom',
    required: false,
    type: Number,
    example: 2015,
    description:
      'Earliest release year, inclusive. Sent to TMDB as `primary_release_date.gte`.',
  })
  @ApiQuery({
    name: 'yearTo',
    required: false,
    type: Number,
    example: 2026,
    description:
      'Latest release year, inclusive. Sent to TMDB as `primary_release_date.lte`.',
  })
  @ApiQuery({
    name: 'minRating',
    required: false,
    type: Number,
    example: 8,
    description: 'Minimum TMDB score, 0–10. Sent as `vote_average.gte`.',
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
  ): Promise<PaginatedMoviesResponse> {
    return this.tmdbService.discoverMovies({
      genreId: query.genre,
      sortBy: query.sort,
      page: query.page,
      yearFrom: query.yearFrom,
      yearTo: query.yearTo,
      minRating: query.minRating,
    });
  }

  /** Public — same as genres and discover. */
  @Get('search')
  @ApiOperation({
    summary: 'Search movies by title',
    description:
      "Proxies TMDB's `/search/movie`. Results are ranked by TMDB relevance " +
      'only: that endpoint supports neither `with_genres`, `vote_average.gte` ' +
      'nor `sort_by`, so genre/rating/sort are intentionally not accepted here ' +
      '— TMDB would ignore them silently. Returns the same shape as ' +
      '`/tmdb/discover`, so the same cards and pagination render both. Public ' +
      '— no authentication required.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    example: 'blade runner',
    description: 'Search text. An empty or whitespace-only value is a 400.',
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
    description: 'A page of relevance-ranked results.',
    type: DiscoverMoviesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or empty `q`, or a page outside 1–500.',
  })
  @ApiResponse({
    status: 500,
    description: 'TMDB_API_KEY is not configured on the server.',
  })
  @ApiResponse({
    status: 503,
    description: 'TMDB was unreachable or returned an error.',
  })
  searchMovies(
    @Query() query: SearchQueryDto,
  ): Promise<PaginatedMoviesResponse> {
    return this.tmdbService.searchMovies({
      query: query.q,
      page: query.page,
    });
  }

  /**
   * Public — same as the other TMDB routes.
   *
   * **Declared last on purpose.** Nest matches routes in declaration order, so
   * a `:tmdbId` wildcard placed above `genres` / `discover` / `search` would
   * swallow them and answer `/tmdb/genres` with "no movie with id genres".
   * `ParseIntPipe` is a second line of defence: a non-numeric segment 400s here
   * rather than reaching TMDB.
   */
  @Get(':tmdbId')
  @ApiOperation({
    summary: 'Movie detail',
    description:
      "Proxies TMDB's `/movie/{id}` with `append_to_response=credits,videos`, " +
      'so cast, crew and trailers arrive in a **single** upstream request ' +
      'rather than three. Returns a normalised `MovieDetail`: full image URLs, ' +
      'the top 10 cast, director names, and the best YouTube trailer (official ' +
      'trailer > any trailer > teaser, else `null`). Public — no auth.',
  })
  @ApiParam({
    name: 'tmdbId',
    type: Number,
    example: 693134,
    description: "TMDB's movie id.",
  })
  @ApiResponse({
    status: 200,
    description: 'The movie.',
    type: MovieDetailDto,
  })
  @ApiResponse({ status: 400, description: 'Non-numeric id.' })
  @ApiResponse({ status: 404, description: 'No movie with that id.' })
  @ApiResponse({
    status: 500,
    description: 'TMDB_API_KEY is not configured on the server.',
  })
  @ApiResponse({
    status: 503,
    description: 'TMDB was unreachable or returned an error.',
  })
  getMovieDetails(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ): Promise<MovieDetail> {
    return this.tmdbService.getMovieDetails(tmdbId);
  }
}
