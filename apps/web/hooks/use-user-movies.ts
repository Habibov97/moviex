"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddUserMovieInput,
  MovieSummary,
  UserMovie,
  UserMovieStatus,
  UserMovieStatusEntry,
} from "@moviex/shared-types";

import { API_BASE_URL } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Root key for everything the `user-movies` module owns.
 *
 * Every query below nests under it, so one
 * `invalidateQueries({ queryKey: USER_MOVIES_KEY })` after any mutation
 * refreshes both the batch status lookups behind the visible badges and the
 * full list — no per-key bookkeeping as more views are added. React Query
 * matches keys by prefix, so that still reaches the per-user keys below.
 */
export const USER_MOVIES_KEY = ["user-movies"] as const;

/**
 * The root key **scoped to one account**, and the only key user-owned data may
 * be cached under.
 *
 * This is a data-isolation control, not a nicety. Without the id, two accounts
 * used in the same browser share one cache entry: signing out and back in as
 * someone else leaves the previous user's list sitting under the identical key,
 * and because the app sets a 60s `staleTime` React Query will serve it without
 * even refetching. The id makes that structurally impossible — a different user
 * is a different cache entry, so there is nothing of theirs to read.
 *
 * `"anonymous"` is only ever used while signed out, where every query below is
 * `enabled: false` and nothing is fetched under it.
 */
export const userMoviesKey = (userId: number | undefined) =>
  [...USER_MOVIES_KEY, userId ?? "anonymous"] as const;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    // The session is an httpOnly cookie; without this it is never attached.
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${response.status}`);
  }

  // DELETE answers 204 with no body.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** One shared empty map, so a signed-out render is referentially stable. */
const NO_STATUSES: ReadonlyMap<number, UserMovieStatus> = new Map();

/**
 * Statuses for the movies currently on screen, as a lookup.
 *
 * One request per grid rather than one per card. Ids the user has not saved
 * are **absent** from the response, so `map.get(id)` returning `undefined` is
 * the "not in list" case — there is nothing to encode for them.
 *
 * Disabled while signed out: there is no list to fetch, and firing it would
 * just produce guaranteed 401s.
 *
 * **`enabled: false` is not on its own enough to blank the badges**, which is
 * the second half of the cross-account leak. Disabling a query stops it
 * fetching; it does not discard what the observer already resolved, so a
 * component reading `query.data` keeps rendering the previous account's
 * statuses for as long as it stays mounted. The `isSignedIn` gate below is what
 * actually makes signed-out mean no badge — see the data-isolation note in
 * CLAUDE.md.
 */
export function useMovieStatuses(tmdbIds: number[]) {
  const { user, isSignedIn } = useCurrentUser();

  // Sorted so the key is stable regardless of render order, and deduped so two
  // views showing the same movie share one cache entry.
  const ids = Array.from(new Set(tmdbIds)).sort((a, b) => a - b);

  const query = useQuery({
    queryKey: [...userMoviesKey(user?.sub), "status", ids.join(",")],
    queryFn: async () => {
      const entries = await request<UserMovieStatusEntry[]>(
        `/user-movies/status?tmdbIds=${ids.join(",")}`,
      );
      return new Map(entries.map((entry) => [entry.tmdbId, entry.status]));
    },
    enabled: isSignedIn && ids.length > 0,
    staleTime: 30_000,
  });

  return {
    /**
     * Empty while loading or signed out — callers read "absent" as "not saved".
     *
     * The `isSignedIn` check is not redundant with `enabled`: it is the thing
     * that stops a stale resolved result being rendered after a sign-out.
     */
    statuses: isSignedIn
      ? (query.data ?? NO_STATUSES)
      : NO_STATUSES,
    isLoading: query.isPending,
  };
}

/** The caller's whole list. Backs the "My List" page. */
export function useUserMovies(status?: UserMovieStatus) {
  const { user, isSignedIn } = useCurrentUser();

  return useQuery({
    queryKey: [...userMoviesKey(user?.sub), "list", status ?? "all"],
    queryFn: () =>
      request<UserMovie[]>(
        status ? `/user-movies?status=${status}` : "/user-movies",
      ),
    enabled: isSignedIn,
  });
}

/**
 * Invalidating the root key is what makes a badge on a Discover card update
 * after the same movie was marked watched on its detail page.
 */
function useInvalidateUserMovies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: USER_MOVIES_KEY });
}

/** `POST /user-movies` — create or update; the API is idempotent. */
export function useAddUserMovie() {
  const invalidate = useInvalidateUserMovies();

  return useMutation({
    mutationKey: [...USER_MOVIES_KEY, "add"],
    mutationFn: (input: AddUserMovieInput) =>
      request<UserMovie>("/user-movies", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void invalidate(),
  });
}

/** `PATCH /user-movies/:tmdbId` — only for an entry that already exists. */
export function useUpdateUserMovieStatus() {
  const invalidate = useInvalidateUserMovies();

  return useMutation({
    mutationKey: [...USER_MOVIES_KEY, "update"],
    mutationFn: ({
      tmdbId,
      status,
    }: {
      tmdbId: number;
      status: UserMovieStatus;
    }) =>
      request<UserMovie>(`/user-movies/${tmdbId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void invalidate(),
  });
}

/** `DELETE /user-movies/:tmdbId`. */
export function useRemoveUserMovie() {
  const invalidate = useInvalidateUserMovies();

  return useMutation({
    mutationKey: [...USER_MOVIES_KEY, "remove"],
    mutationFn: (tmdbId: number) =>
      request<void>(`/user-movies/${tmdbId}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });
}

/**
 * The snapshot the API stores alongside an entry, taken from whatever card or
 * detail page the user acted on — see the entity for why it is denormalised.
 */
export function snapshotOf(
  movie: Pick<MovieSummary, "tmdbId" | "title" | "posterUrl" | "releaseYear"> & {
    /**
     * TMDB genre **id** of the movie's primary genre — an id, never a resolved
     * name. One id is enough for My List to tally a top genre without a TMDB
     * call or a relation table, and being language-free is what lets the stat
     * re-render in the reader's language rather than the saver's.
     */
    primaryGenreId?: number | null;
  },
) {
  return {
    tmdbId: movie.tmdbId,
    title: movie.title,
    posterUrl: movie.posterUrl,
    releaseYear: movie.releaseYear,
    primaryGenreId: movie.primaryGenreId ?? null,
  };
}
