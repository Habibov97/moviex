/**
 * A user's saved movies — the `user-movies` module.
 *
 * There is deliberately no rating or review: a movie is either on the
 * watchlist or watched, and that is the whole model.
 */

export type UserMovieStatus = 'watchlist' | 'watched';

/**
 * One saved entry.
 *
 * `title` / `posterUrl` / `releaseYear` are a **denormalised snapshot** taken
 * from whatever card or detail page the user acted on. The client already has
 * them at that moment, so storing them avoids a TMDB round trip per entry when
 * saving *and* lets "My List" render straight from our own database instead of
 * re-fetching TMDB for every row.
 */
export type UserMovie = {
  id: string;
  tmdbId: number;
  status: UserMovieStatus;
  title: string;
  posterUrl: string | null;
  releaseYear: string | null;
  /**
   * TMDB genre id of the movie's primary genre — **an id, not a name**, and
   * deliberately not part of the snapshot above.
   *
   * A genre id is locale-independent, so My List's "top genre" stat resolves it
   * to a word at render time against the genre list already fetched for the
   * page. That is what makes the stat follow the language switcher instead of
   * being frozen in whatever language the film was saved in.
   */
  primaryGenreId: number | null;
  /**
   * @deprecated Legacy. The resolved genre **name** at save time, which is
   * precisely the bug `primaryGenreId` replaced: it froze in the saving
   * locale. Nothing reads it and the client no longer sends it; the column
   * survives only so the change needed no destructive migration.
   */
  primaryGenre: string | null;
  /** Set when status becomes `watched`, cleared when moved back. */
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `POST /user-movies`. `status` defaults to `watchlist`. */
export type AddUserMovieInput = {
  tmdbId: number;
  status?: UserMovieStatus;
  title: string;
  posterUrl?: string | null;
  releaseYear?: string | null;
  /** TMDB genre id of the movie's first genre. See {@link UserMovie}. */
  primaryGenreId?: number | null;
  /**
   * @deprecated Still accepted so an older client cannot be rejected by the
   * API's `forbidNonWhitelisted`, but no longer sent and never read.
   */
  primaryGenre?: string | null;
};

/** `PATCH /user-movies/:tmdbId`. */
export type UpdateUserMovieStatusInput = {
  status: UserMovieStatus;
};

/**
 * One row of `GET /user-movies/status?tmdbIds=…`.
 *
 * Only movies the user actually has an entry for are returned — a tmdbId
 * absent from the response means "not in the list". No `null` placeholders, so
 * the payload stays proportional to what is saved rather than to what is on
 * screen.
 */
export type UserMovieStatusEntry = {
  tmdbId: number;
  status: UserMovieStatus;
};
