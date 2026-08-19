import type { DiscoverMoviesResponse, Genre } from "@moviex/shared-types";

/**
 * Base URL of our own NestJS API. `API_URL` is server-only (no `NEXT_PUBLIC_`
 * prefix) because every call in this file runs in a Server Component.
 */
const API_URL = process.env.API_URL ?? "http://localhost:3000";

/** Genres change rarely — a day-old list is fine. */
const GENRES_REVALIDATE_SECONDS = 86_400;

/**
 * The TMDB genre list, via our API.
 *
 * Cached by Next's `fetch` for 24h — that is the whole caching story here, no
 * Redis or database involved.
 *
 * A failure returns an empty list rather than throwing: genres drive an
 * optional filter, so an unreachable API should cost the user their genre
 * chips, not the entire Discover page (and, at build time, not the build).
 */
export async function getGenres(): Promise<Genre[]> {
  try {
    const response = await fetch(`${API_URL}/tmdb/genres`, {
      next: { revalidate: GENRES_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      console.error(`GET /tmdb/genres responded ${response.status}`);
      return [];
    }

    return (await response.json()) as Genre[];
  } catch (error) {
    console.error("GET /tmdb/genres failed", error);
    return [];
  }
}

export type DiscoverMoviesArgs = {
  /** TMDB genre id, or `null` for no genre filter. */
  genreId?: number | null;
  /** TMDB `sort_by` value. */
  sort?: string;
  page?: number;
};

/**
 * A page of discover results, via our API.
 *
 * `cache: "no-store"` — deliberately unlike {@link getGenres}: results vary per
 * filter combination and change as TMDB's popularity shifts, so there is
 * nothing worth reusing between requests.
 *
 * Failures **throw**, again unlike `getGenres`. Movies are the page's whole
 * content: an empty grid would read as "no films match this filter", which is a
 * different and misleading statement.
 */
export async function getDiscoverMovies({
  genreId,
  sort = "popularity.desc",
  page,
}: DiscoverMoviesArgs = {}): Promise<DiscoverMoviesResponse> {
  const params = new URLSearchParams({ sort });
  if (genreId != null) params.set("genre", String(genreId));
  if (page != null) params.set("page", String(page));

  const response = await fetch(`${API_URL}/tmdb/discover?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `GET /tmdb/discover responded ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as DiscoverMoviesResponse;
}
