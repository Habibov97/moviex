import type { UserMovieStatus } from './user-movie';

/**
 * Public list sharing — a user's whole list (watchlist *and* watched) behind
 * an unguessable link, `/shared/<token>`.
 */

/**
 * `GET|POST /list-share` — the caller's own share state. `token` is `null`
 * while the list is not shared.
 */
export type ListShare = {
  token: string | null;
};

/**
 * One movie as a shared list exposes it.
 *
 * Deliberately a **subset** of `UserMovie`: no row id, no `userId`, no
 * timestamps beyond the one the page sorts by. Whatever goes in here is
 * readable by anyone holding the link, so it carries what the page renders
 * and nothing more.
 */
export type SharedListMovie = {
  tmdbId: number;
  status: UserMovieStatus;
  title: string;
  posterUrl: string | null;
  releaseYear: string | null;
  /** Resolved to a name in the *viewer's* language, as on My List. */
  primaryGenreId: number | null;
  /** When it was added — the page lists newest first, like My List. */
  createdAt: string;
};

/** `GET /shared-lists/:token` — public, no session needed. */
export type SharedList = {
  /** The owner's public display name. Never their email or id. */
  userName: string;
  movies: SharedListMovie[];
};
