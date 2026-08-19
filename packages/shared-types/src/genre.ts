/**
 * A TMDB movie genre, kept in TMDB's own shape on purpose.
 *
 * `id` is TMDB's numeric genre id — the exact value their `/discover/movie`
 * endpoint takes as `with_genres`, so it can be passed straight through as a
 * filter without a lookup table on either side. Nothing in this repo hard-codes
 * the genre list; it is always fetched from `GET /tmdb/genres`.
 */
export type Genre = {
  id: number;
  name: string;
};
