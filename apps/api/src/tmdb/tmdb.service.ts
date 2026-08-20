import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type {
  Genre,
  MovieDetail,
  MovieSummary,
  MovieTrailer,
  PaginatedMoviesResponse,
} from '@moviex/shared-types';
import tmdbConfig from 'src/config/tmdb.config';

/** TMDB's `/genre/movie/list` envelope — the array is nested under `genres`. */
interface TmdbGenreListResponse {
  genres: Genre[];
}

/**
 * The subset of a TMDB movie result we actually read.
 *
 * Optional/nullable wherever TMDB's catalogue is patchy — `vote_average` and
 * `vote_count` are genuinely absent on some entries, so typing them as plain
 * `number` (as this did) lets `undefined` through to the frontend disguised as
 * a number.
 */
interface TmdbMovieResult {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  release_date: string | null;
  genre_ids: number[];
  overview: string | null;
}

/** Discover and search return the same envelope; only the ranking differs. */
interface TmdbPaginatedResponse {
  page: number;
  results: TmdbMovieResult[];
  total_pages: number;
  total_results: number;
}

/**
 * TMDB's score, or `null` when there isn't one.
 *
 * Two distinct gaps collapse to `null` here so the frontend has a single case
 * to handle:
 *  - the field is missing or `null` outright (this crashed the UI once, via
 *    `undefined.toFixed()`, on a deep search page);
 *  - `vote_count` is 0, where TMDB reports `vote_average: 0`. That means
 *    "nobody has rated it", not "rated zero" — showing "0.0" beside a star
 *    would state something false about the film.
 */
function toRating(result: {
  vote_average?: number | null;
  vote_count?: number | null;
}): number | null {
  if (result.vote_average === null || result.vote_average === undefined) {
    return null;
  }

  // Only trusted when TMDB actually sends a count; an absent count is not
  // evidence of zero votes.
  if (result.vote_count === 0) return null;

  return result.vote_average;
}

/** Raw `/movie/{id}?append_to_response=credits,videos`. */
interface TmdbMovieDetailResult {
  id: number;
  title: string;
  original_title: string;
  tagline?: string | null;
  overview?: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  release_date?: string | null;
  runtime?: number | null;
  original_language?: string | null;
  status?: string | null;
  genres?: Genre[];
  credits?: {
    cast?: {
      id: number;
      name: string;
      character?: string;
      profile_path: string | null;
    }[];
    crew?: { id: number; name: string; job: string }[];
  };
  videos?: { results?: TmdbVideo[] };
}

interface TmdbVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
}

/** Cast members kept; the UI shows 5 and expands to the rest. */
const DETAIL_CAST_LIMIT = 10;

/**
 * The best available YouTube clip, or `null`.
 *
 * Preference order: an official Trailer, then any Trailer, then a Teaser —
 * plenty of films have only a teaser, and something is better than hiding the
 * button. Non-YouTube sites are dropped because the player embeds YouTube.
 */
function pickTrailer(videos: TmdbVideo[]): MovieTrailer | null {
  const youtube = videos.filter((video) => video.site === 'YouTube');
  const trailers = youtube.filter((video) => video.type === 'Trailer');

  const chosen =
    trailers.find((video) => video.official) ??
    trailers[0] ??
    youtube.find((video) => video.type === 'Teaser');

  return chosen ? { key: chosen.key, name: chosen.name } : null;
}

/** Base for TMDB image URLs; `w500` is the width the cards are laid out for. */
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

/** Backdrops are a full-width hero band, so they need a wider rendition. */
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

const DEFAULT_SORT_BY = 'popularity.desc';
const DEFAULT_PAGE = 1;

/**
 * Filters accepted by `discoverMovies`. Every one is forwarded to TMDB; an
 * omitted field means "no filter" rather than a default value.
 */
export interface DiscoverMoviesParams {
  genreId?: number;
  sortBy?: string;
  page?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
}

/** `/search/movie` accepts nothing else — see `searchMovies`. */
export interface SearchMoviesParams {
  query: string;
  page?: number;
}

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);

  constructor(
    @Inject(tmdbConfig.KEY)
    private readonly tmdbConfiguration: ConfigType<typeof tmdbConfig>,
  ) {}

  /**
   * The full TMDB movie genre list.
   *
   * Returned exactly as TMDB sends it (`{ id, name }`) so `id` can be handed
   * straight back as the `with_genres` filter value — renaming anything here
   * would force a translation layer on the frontend for no gain.
   */
  async getGenres(): Promise<Genre[]> {
    const { genres } = await this.request<TmdbGenreListResponse>(
      '/genre/movie/list',
      { language: 'en-US' },
    );

    return genres;
  }

  /**
   * A page of discover results, normalised into `MovieSummary`.
   *
   * Unlike `getGenres()` this never degrades to an empty result: movies are the
   * page's whole content, so an upstream failure propagates as a real error
   * rather than rendering as "no films matched your filter".
   */
  async discoverMovies(
    params: DiscoverMoviesParams = {},
  ): Promise<PaginatedMoviesResponse> {
    const query: Record<string, string> = {
      language: 'en-US',
      sort_by: params.sortBy ?? DEFAULT_SORT_BY,
      page: String(params.page ?? DEFAULT_PAGE),
    };

    // Omitted entirely when absent — TMDB treats an empty `with_genres` as a
    // filter that matches nothing rather than as "no filter".
    if (params.genreId !== undefined) {
      query.with_genres = String(params.genreId);
    }

    /*
     * Year range as a date pair, not TMDB's single `year` param, so a span like
     * 2015–2026 is expressible. Bounds are widened to whole years — Jan 1 of
     * `yearFrom` through Dec 31 of `yearTo` — so a film released in December of
     * the final year is not excluded.
     */
    if (params.yearFrom !== undefined) {
      query['primary_release_date.gte'] = `${params.yearFrom}-01-01`;
    }
    if (params.yearTo !== undefined) {
      query['primary_release_date.lte'] = `${params.yearTo}-12-31`;
    }
    if (params.minRating !== undefined) {
      query['vote_average.gte'] = String(params.minRating);
    }

    const response = await this.request<TmdbPaginatedResponse>(
      '/discover/movie',
      query,
    );

    return this.toPaginatedResponse(response);
  }

  /**
   * Relevance-ranked search results.
   *
   * TMDB's `/search/movie` supports only `query` and `page` — there is no
   * `with_genres`, `vote_average.gte` or `sort_by`. Filters left over in the
   * frontend URL from a Discover visit are deliberately *not* forwarded: TMDB
   * would ignore them silently, which reads as a broken filter rather than an
   * unsupported one.
   *
   * Same failure policy as `discoverMovies` — an upstream error throws rather
   * than returning an empty page.
   */
  async searchMovies(
    params: SearchMoviesParams,
  ): Promise<PaginatedMoviesResponse> {
    const query = params.query.trim();

    if (!query) {
      // Never sent upstream: TMDB answers an empty query with a 422, which
      // would surface here as a misleading "TMDB unavailable" 503.
      throw new BadRequestException('query must not be empty');
    }

    const response = await this.request<TmdbPaginatedResponse>(
      '/search/movie',
      {
        language: 'en-US',
        query,
        page: String(params.page ?? DEFAULT_PAGE),
      },
    );

    return this.toPaginatedResponse(response);
  }

  /**
 * One movie's full detail.
 *
 * **Single request.** `credits` and `videos` are not in the base `/movie/{id}`
 * payload, but `append_to_response` folds them into the same call — three round
 * trips would triple the latency and burn three times the rate limit for the
 * same data. Any further sub-resource (`images`, `recommendations`, …) should
 * be appended here rather than fetched separately.
 */
async getMovieDetails(tmdbId: number): Promise<MovieDetail> {
  const result = await this.request<TmdbMovieDetailResult>(
    `/movie/${tmdbId}`,
    { language: 'en-US', append_to_response: 'credits,videos' },
    // A bad id is the caller's mistake, not a TMDB outage.
    { notFoundMessage: `No movie with id ${tmdbId}` },
  );

  return {
    tmdbId: result.id,
    title: result.title,
    originalTitle: result.original_title,
    // TMDB uses "" rather than null for these two.
    tagline: result.tagline || null,
    overview: result.overview || null,
    posterUrl: result.poster_path
      ? `${TMDB_IMAGE_BASE}${result.poster_path}`
      : null,
    // Wider crop than a poster, so a wider rendition.
    backdropUrl: result.backdrop_path
      ? `${TMDB_BACKDROP_BASE}${result.backdrop_path}`
      : null,
    rating: toRating(result),
    voteCount: result.vote_count ?? null,
    releaseDate: result.release_date || null,
    releaseYear: result.release_date ? result.release_date.slice(0, 4) : null,
    // TMDB reports 0 for an unknown runtime, which is not a real duration.
    runtime: result.runtime ? result.runtime : null,
    originalLanguage: result.original_language || null,
    status: result.status || null,
    genres: result.genres ?? [],
    cast: (result.credits?.cast ?? [])
      .slice(0, DETAIL_CAST_LIMIT)
      .map((member) => ({
        id: member.id,
        name: member.name,
        character: member.character ?? '',
        profileUrl: member.profile_path
          ? `${TMDB_IMAGE_BASE}${member.profile_path}`
          : null,
      })),
    directors: (result.credits?.crew ?? [])
      .filter((member) => member.job === 'Director')
      .map((member) => member.name),
    trailer: pickTrailer(result.videos?.results ?? []),
  };
}

/** The page envelope, shared by discover and search. */
  private toPaginatedResponse(
    response: TmdbPaginatedResponse,
  ): PaginatedMoviesResponse {
    return {
      results: response.results.map((result) => this.toMovieSummary(result)),
      page: response.page,
      totalPages: response.total_pages,
      totalResults: response.total_results,
    };
  }

  /** TMDB's wire format → our shape. The only place snake_case is read. */
  private toMovieSummary(result: TmdbMovieResult): MovieSummary {
    return {
      tmdbId: result.id,
      title: result.title,
      // A null path must stay null: concatenating it would produce a URL like
      // ".../w500null", which 404s and shows a broken image.
      posterUrl: result.poster_path
        ? `${TMDB_IMAGE_BASE}${result.poster_path}`
        : null,
      rating: toRating(result),
      // TMDB sends "" (not null) for undated entries, so check truthiness
      // before slicing rather than trusting the field to be absent.
      releaseYear: result.release_date ? result.release_date.slice(0, 4) : null,
      genreIds: result.genre_ids ?? [],
      overview: result.overview ? result.overview : null,
    };
  }

  /**
   * Thin TMDB fetch helper. Uses Node's global `fetch` — no HTTP client
   * dependency is needed for this, and `@nestjs/axios` is not installed.
   */
  private async request<T>(
    path: string,
    params: Record<string, string> = {},
    options: { notFoundMessage?: string } = {},
  ): Promise<T> {
    const apiKey = this.tmdbConfiguration.apiKey;

    if (!apiKey) {
      // A config problem, not an upstream one — surfaced separately so a
      // missing key never looks like a TMDB outage.
      this.logger.error('TMDB_API_KEY is not set');
      throw new InternalServerErrorException('TMDB is not configured');
    }

    const url = new URL(`${this.tmdbConfiguration.baseUrl}${path}`);
    url.searchParams.set('api_key', apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(`TMDB request to ${path} failed`, error as Error);
      throw new ServiceUnavailableException('Could not reach TMDB');
    }

    if (!response.ok) {
      /*
       * A TMDB 404 is the one upstream status that maps cleanly onto ours: the
       * resource genuinely does not exist, so the caller gets a 404 rather than
       * "TMDB unavailable" — but only where the caller named a resource, hence
       * the opt-in. TMDB's own message is not forwarded.
       */
      if (response.status === 404 && options.notFoundMessage) {
        throw new NotFoundException(options.notFoundMessage);
      }

      // Everything else is deliberately not forwarded verbatim: TMDB's status
      // codes would otherwise be mistaken for this API's (a TMDB 401 means
      // *our* key is bad, which is not the caller's fault).
      this.logger.error(`TMDB responded ${response.status} for ${path}`);
      throw new ServiceUnavailableException('TMDB request failed');
    }

    return (await response.json()) as T;
  }
}
