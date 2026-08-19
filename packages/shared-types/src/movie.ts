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
  /** TMDB's `vote_average`, 0–10; the UI renders it with a single decimal. */
  rating: number;
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

/** A page of discover results, mirroring TMDB's pagination. */
export type DiscoverMoviesResponse = {
  results: MovieSummary[];
  page: number;
  totalPages: number;
  totalResults: number;
};

export type MovieSortId = 'popularity' | 'rating' | 'release-date' | 'title';

/** Query shape the discover endpoint will accept. */
export type DiscoverFilters = {
  /** TMDB genre id, or `null` for "Tümü" — no genre filter applied. */
  genreId: number | null;
  yearFrom: number;
  yearTo: number;
  minRating: number;
  sort: MovieSortId;
};
