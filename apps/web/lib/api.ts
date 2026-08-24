import type {
  Genre,
  Locale,
  MovieDetail,
  PaginatedMoviesResponse,
} from "@moviex/shared-types";

/**
 * The query param every `/tmdb/*` endpoint takes to pick a language.
 *
 * The API maps it to TMDB's own tag (`tr` → `tr-TR`) — see `toTmdbLanguage` in
 * `@moviex/shared-types`. It is always sent, English included, so a URL's
 * meaning never depends on a server-side default.
 *
 * It also does the caching for free: `lang` is part of the request URL, and
 * Next keys its `fetch` cache by URL, so each locale gets its own entry rather
 * than the first visitor's language being served to everyone.
 */
const LANG_PARAM = "lang";

/**
 * Base URL of our own NestJS API.
 *
 * Two variables on purpose: `getSearchResults` is called from the navbar
 * typeahead, which runs in the **browser**, where a server-only `API_URL` is
 * `undefined`. Next inlines `NEXT_PUBLIC_API_URL` into the client bundle, so
 * that one has to be set for the typeahead to reach the API in any deployed
 * environment; `API_URL` still covers the Server Component calls.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:3000";

/** Local alias so the rest of this file reads as before. */
const API_URL = API_BASE_URL;

/*
 * Dev-only guard for the failure this exists to prevent.
 *
 * The session is a `SameSite=Lax` cookie. If the browser is on one host and
 * `NEXT_PUBLIC_API_URL` points at another — `localhost` vs a LAN IP — the
 * request is *cross-site*, so the cookie is neither stored nor sent, and
 * `/auth/me` answers 401 forever. Login still returns 200, which is what makes
 * it so confusing: the app looks logged out with no error anywhere.
 *
 * The two hosts must match. Warn loudly rather than fail silently.
 */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  try {
    const apiHost = new URL(API_BASE_URL).hostname;
    if (apiHost !== window.location.hostname) {
      console.warn(
        `[moviex] NEXT_PUBLIC_API_URL host "${apiHost}" does not match the ` +
          `browser host "${window.location.hostname}". The auth cookie is ` +
          `SameSite=Lax, so it will not be sent cross-site and you will ` +
          `appear permanently signed out. Use the same host for both.`,
      );
    }
  } catch {
    // A malformed URL is not worth crashing the app over.
  }
}

/**
 * Backoff between retries, in milliseconds — one entry per retry, so the length
 * of this array *is* the retry count. Two short waits: this exists to bridge a
 * gap measured in milliseconds to low seconds (the API still booting, or being
 * replaced mid-deploy), not to keep a genuinely dead backend hidden behind a
 * spinner. Total added latency before the error surfaces is ~900ms.
 */
const RETRY_DELAYS_MS = [300, 600];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `true` for the one throw that must never be retried: a caller that cancelled
 * the request on purpose. The typeahead aborts superseded searches, and retrying
 * those would resurrect requests whose results are already unwanted.
 */
function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError";
}

/**
 * `fetch` with a short retry window for **network-level** failures only.
 *
 * The race this fixes: `npm run dev` starts both apps in parallel and Next
 * becomes ready before Nest has finished connecting to Postgres, so the first
 * server-rendered fetch can hit a port nothing is listening on and throw
 * `TypeError: fetch failed` / `ECONNREFUSED`. The same window exists in
 * production every time the API restarts during a deploy.
 *
 * **Only a throwing `fetch` is retried.** An HTTP response — 404, 400, 503,
 * anything — is a real answer from a reachable server, so it is returned
 * untouched on the first attempt and each caller applies its own policy to it
 * (discover/search/detail throw, genres degrade to `[]`, a movie 404 becomes
 * `null`). Retrying a status code would multiply load on an API that is already
 * struggling and delay an error the user needs to see.
 *
 * Once the retries are exhausted the original error is rethrown unchanged, so
 * every existing failure path — `error.tsx` boundaries included — behaves
 * exactly as it did before. This only adds a brief window in front of them.
 */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      const delayMs = RETRY_DELAYS_MS[attempt];

      // Out of retries, or a deliberate cancellation: propagate as-is.
      if (delayMs === undefined || isAbortError(error)) throw error;

      console.warn(
        `[moviex] ${url} unreachable (attempt ${attempt + 1}/${
          RETRY_DELAYS_MS.length + 1
        }), retrying in ${delayMs}ms`,
        error,
      );

      await sleep(delayMs);
    }
  }
}

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
export async function getGenres(locale: Locale): Promise<Genre[]> {
  try {
    const response = await fetchWithRetry(
      `${API_URL}/tmdb/genres?${LANG_PARAM}=${locale}`,
      {
        next: { revalidate: GENRES_REVALIDATE_SECONDS },
      },
    );

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
  /** Language for titles and overviews. Always sent. */
  locale: Locale;
  /** TMDB genre id, or `null` for no genre filter. */
  genreId?: number | null;
  /** TMDB `sort_by` value. */
  sort?: string;
  page?: number;
  /** Release-year bounds. Sent only when they narrow the full span. */
  yearFrom?: number | null;
  yearTo?: number | null;
  /** Minimum TMDB score, or `null` for no rating floor. */
  minRating?: number | null;
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
  locale,
  genreId,
  sort = "popularity.desc",
  page,
  yearFrom,
  yearTo,
  minRating,
}: DiscoverMoviesArgs): Promise<PaginatedMoviesResponse> {
  const params = new URLSearchParams({ sort, [LANG_PARAM]: locale });
  if (genreId != null) params.set("genre", String(genreId));
  if (page != null) params.set("page", String(page));
  if (yearFrom != null) params.set("yearFrom", String(yearFrom));
  if (yearTo != null) params.set("yearTo", String(yearTo));
  if (minRating != null) params.set("minRating", String(minRating));

  const response = await fetchWithRetry(`${API_URL}/tmdb/discover?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `GET /tmdb/discover responded ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as PaginatedMoviesResponse;
}

export type SearchMoviesArgs = {
  query: string;
  /** Language for titles and overviews. Always sent. */
  locale: Locale;
  page?: number;
};

/**
 * Relevance-ranked search results, via our API.
 *
 * Only `q` and `page` are sent: TMDB's search endpoint supports nothing else,
 * and our API rejects unknown params outright — so leftover genre/rating/sort
 * params sitting in the browser URL must not be forwarded here.
 *
 * Same policy as {@link getDiscoverMovies}: `no-store`, and failures throw.
 */
export async function getSearchResults({
  query,
  locale,
  page,
}: SearchMoviesArgs): Promise<PaginatedMoviesResponse> {
  const params = new URLSearchParams({ q: query, [LANG_PARAM]: locale });
  if (page != null) params.set("page", String(page));

  const response = await fetchWithRetry(`${API_URL}/tmdb/search?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `GET /tmdb/search responded ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as PaginatedMoviesResponse;
}

/** A movie's details change rarely; an hour-old copy is fine. */
const MOVIE_DETAIL_REVALIDATE_SECONDS = 3600;

/**
 * One movie's full detail, via our API.
 *
 * Cached for an hour — unlike search and discover, which are `no-store`
 * because their results depend on a query and shift with TMDB popularity. A
 * single movie is a stable resource, so re-fetching it per request would be
 * pure waste.
 *
 * Returns `null` on 404 so the page can render `notFound()` rather than a 500;
 * anything else throws.
 */
export async function getMovieDetail(
  tmdbId: number,
  locale: Locale,
): Promise<MovieDetail | null> {
  const response = await fetchWithRetry(
    `${API_URL}/tmdb/${tmdbId}?${LANG_PARAM}=${locale}`,
    {
      next: { revalidate: MOVIE_DETAIL_REVALIDATE_SECONDS },
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `GET /tmdb/${tmdbId} responded ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as MovieDetail;
}
