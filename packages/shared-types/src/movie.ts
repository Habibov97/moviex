import type { Genre } from './genre';

/**
 * The catalogue contract the discover screens are built against.
 *
 * These shapes are what `apps/api` returns after normalising TMDB — the web
 * components are typed against them directly, so no adapter layer sits in
 * between and a change to the API shape fails to compile rather than silently
 * rendering blanks.
 */

/**
 * How the signed-in user has already engaged with a film. Absent (or `null`)
 * means neither — the card then shows no status tag.
 */
export type MovieUserState = 'watched' | 'listed';

/**
 * A single film as the discover grid and list render it.
 *
 * Normalised from TMDB's `/discover/movie` result: relative paths are resolved
 * to full URLs and snake_case is dropped, so nothing downstream needs to know
 * TMDB's wire format.
 */
export type MovieSummary = {
  /** TMDB's movie id. The identity used for keys and, later, list membership. */
  tmdbId: number;
  title: string;
  /**
   * Fully-qualified poster URL, already expanded from TMDB's relative
   * `poster_path`. `null` when TMDB has no artwork — the card then falls back
   * to its skeleton tone rather than requesting a broken URL.
   */
  posterUrl: string | null;
  /**
   * TMDB's `vote_average`, 0–10, rendered with a single decimal.
   *
   * `null` when TMDB has no score for the title — either the field is missing
   * outright, or `vote_count` is 0, in which case a `vote_average` of `0` means
   * "unrated" rather than "rated zero". Nullable for the same reason as
   * `releaseYear`: TMDB's catalogue is not uniformly populated, and every
   * render site has to handle the gap.
   */
  rating: number | null;
  /**
   * Four-digit year as a string, sliced from TMDB's `release_date`. `null` for
   * unreleased or undated entries, which TMDB returns with an empty date.
   */
  releaseYear: string | null;
  /**
   * TMDB genre ids. Display names are resolved against the live genre list at
   * render time — never stored here, so a genre rename needs no data migration.
   */
  genreIds: number[];
  /**
   * Synopsis, clamped to two lines by the list view. TMDB returns an empty
   * string when it has none, normalised to `null` here.
   */
  overview: string | null;
  /**
   * Not from TMDB — filled in by our API once a signed-in user's list is joined
   * onto the results. Until then it is always absent and no status tag renders.
   */
  userState?: MovieUserState | null;
};

/**
 * A page of movie results, mirroring TMDB's pagination.
 *
 * Shared by `/tmdb/discover` and `/tmdb/search` — they differ in how results
 * are chosen, not in what a page of them looks like, so the frontend reuses the
 * same card, grid and pagination components for both.
 */
export type PaginatedMoviesResponse = {
  results: MovieSummary[];
  page: number;
  totalPages: number;
  totalResults: number;
};

/** @deprecated Use {@link PaginatedMoviesResponse}; search returns it too. */
export type DiscoverMoviesResponse = PaginatedMoviesResponse;

/**
 * Our own sort vocabulary, kept deliberately separate from TMDB's `sort_by`
 * strings — these are what appear in the URL, and the TMDB value is looked up
 * from them at request time (see `SORT_OPTIONS` in `apps/web`).
 */
export type MovieSortId = 'popularity' | 'rating' | 'newest' | 'oldest';

/** Query shape the discover endpoint will accept. */
export type DiscoverFilters = {
  /** TMDB genre id, or `null` for "All" — no genre filter applied. */
  genreId: number | null;
  yearFrom: number;
  yearTo: number;
  minRating: number;
  sort: MovieSortId;
};

/** One credited performer, from TMDB's `credits.cast`. */
export type CastMember = {
  id: number;
  name: string;
  character: string;
  /** Full headshot URL, or `null` when TMDB has no `profile_path`. */
  profileUrl: string | null;
};

/** A YouTube trailer/teaser, from TMDB's `videos.results`. */
export type MovieTrailer = {
  /** YouTube video id — build the embed as `youtube.com/embed/{key}`. */
  key: string;
  name: string;
};

/**
 * A single movie's full detail, assembled from TMDB's `/movie/{id}` plus its
 * `credits` and `videos` sub-resources in one `append_to_response` request.
 *
 * Almost everything optional is genuinely nullable in TMDB's data — see the
 * nullable-fields note in CLAUDE.md. `rating` follows the same
 * `voteCount === 0 → null` rule as `MovieSummary`.
 */
export type MovieDetail = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  tagline: string | null;
  overview: string | null;
  posterUrl: string | null;
  /** Wider crop than the poster — used as the hero band background. */
  backdropUrl: string | null;
  rating: number | null;
  voteCount: number | null;
  releaseDate: string | null;
  releaseYear: string | null;
  /** Minutes. TMDB reports `0` for unknown runtimes, normalised to `null`. */
  runtime: number | null;
  /** ISO 639-1 code, e.g. `en`. */
  originalLanguage: string | null;
  status: string | null;
  genres: Genre[];
  cast: CastMember[];
  /** Every crew member with `job === 'Director'`; usually one, sometimes two. */
  directors: string[];
  trailer: MovieTrailer | null;
};
