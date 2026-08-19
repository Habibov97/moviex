import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type {
  DiscoverMoviesResponse,
  Genre,
  MovieSummary,
} from '@moviex/shared-types';
import tmdbConfig from 'src/config/tmdb.config';

/** TMDB's `/genre/movie/list` envelope — the array is nested under `genres`. */
interface TmdbGenreListResponse {
  genres: Genre[];
}

/** The subset of TMDB's discover result we actually read. */
interface TmdbDiscoverResult {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string | null;
  genre_ids: number[];
  overview: string | null;
}

interface TmdbDiscoverResponse {
  page: number;
  results: TmdbDiscoverResult[];
  total_pages: number;
  total_results: number;
}

/** Base for TMDB image URLs; `w500` is the width the cards are laid out for. */
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const DEFAULT_SORT_BY = 'popularity.desc';
const DEFAULT_PAGE = 1;

/**
 * Filters accepted by `discoverMovies`.
 *
 * `yearFrom`/`yearTo`/`minRating` are accepted but not yet forwarded — the UI
 * chips for them are still stubs. They are declared now so wiring them up later
 * does not change this signature.
 */
export interface DiscoverMoviesParams {
  genreId?: number;
  sortBy?: string;
  page?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
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
  ): Promise<DiscoverMoviesResponse> {
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

    // TODO: forward yearFrom/yearTo/minRating as
    // primary_release_date.gte/.lte and vote_average.gte once their chips work.

    const response = await this.request<TmdbDiscoverResponse>(
      '/discover/movie',
      query,
    );

    return {
      results: response.results.map((result) => this.toMovieSummary(result)),
      page: response.page,
      totalPages: response.total_pages,
      totalResults: response.total_results,
    };
  }

  /** TMDB's wire format → our shape. The only place snake_case is read. */
  private toMovieSummary(result: TmdbDiscoverResult): MovieSummary {
    return {
      tmdbId: result.id,
      title: result.title,
      // A null path must stay null: concatenating it would produce a URL like
      // ".../w500null", which 404s and shows a broken image.
      posterUrl: result.poster_path
        ? `${TMDB_IMAGE_BASE}${result.poster_path}`
        : null,
      rating: result.vote_average,
      // TMDB sends "" (not null) for undated entries, so check truthiness
      // before slicing rather than trusting the field to be absent.
      releaseYear: result.release_date
        ? result.release_date.slice(0, 4)
        : null,
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
      // Deliberately not forwarded verbatim: TMDB's own status codes would
      // otherwise be mistaken for this API's (a TMDB 401 means *our* key is
      // bad, which is not the caller's fault).
      this.logger.error(
        `TMDB responded ${response.status} for ${path}`,
      );
      throw new ServiceUnavailableException('TMDB request failed');
    }

    return (await response.json()) as T;
  }
}
