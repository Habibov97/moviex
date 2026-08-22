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
 * full list — no per-key bookkeeping as more views are added.
 */
export const USER_MOVIES_KEY = ["user-movies"] as const;

const statusKey = (tmdbIds: number[]) =>
  [...USER_MOVIES_KEY, "status", tmdbIds.join(",")] as const;

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

/**
 * Statuses for the movies currently on screen, as a lookup.
 *
 * One request per grid rather than one per card. Ids the user has not saved
 * are **absent** from the response, so `map.get(id)` returning `undefined` is
 * the "not in list" case — there is nothing to encode for them.
 *
 * Disabled while signed out: there is no list to fetch, and firing it would
 * just produce guaranteed 401s.
 */
export function useMovieStatuses(tmdbIds: number[]) {
  const { isSignedIn } = useCurrentUser();

  // Sorted so the key is stable regardless of render order, and deduped so two
  // views showing the same movie share one cache entry.
  const ids = Array.from(new Set(tmdbIds)).sort((a, b) => a - b);

  const query = useQuery({
    queryKey: statusKey(ids),
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
    /** Empty while loading or signed out — callers read "absent" as "not saved". */
    statuses: query.data ?? new Map<number, UserMovieStatus>(),
    isLoading: query.isPending,
  };
}

/** The caller's whole list. Backs the future "My List" page. */
export function useUserMovies(status?: UserMovieStatus) {
  const { isSignedIn } = useCurrentUser();

  return useQuery({
    queryKey: [...USER_MOVIES_KEY, "list", status ?? "all"],
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
     * Primary genre **name**, resolved by the caller against the live genre
     * list. Stored as one string so My List can tally a top genre without a
     * TMDB call or a relation table.
     */
    primaryGenre?: string | null;
  },
) {
  return {
    tmdbId: movie.tmdbId,
    title: movie.title,
    posterUrl: movie.posterUrl,
    releaseYear: movie.releaseYear,
    primaryGenre: movie.primaryGenre ?? null,
  };
}
