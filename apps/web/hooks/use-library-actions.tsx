"use client";

import { useCallback, useState } from "react";
import type { MovieSummary } from "@moviex/shared-types";

import { LoginRegisterModal } from "@/components/auth/LoginRegisterModal";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  snapshotOf,
  useAddUserMovie,
  useRemoveUserMovie,
  useUpdateUserMovieStatus,
} from "@/hooks/use-user-movies";

/**
 * The one place a library action is gated on being signed in.
 *
 * Every "Add to list" / "Mark as watched" affordance in the app — the detail
 * page's button row and the Add button on every card — goes through this, so
 * the auth rule and the placeholder handlers exist exactly once. Duplicating
 * the check per surface is how they drift.
 *
 * The modal comes back as an element rather than being rendered here, because
 * a hook cannot render: the caller drops `{authModal}` into its own tree. That
 * still means one `LoginRegisterModal` implementation and one piece of open
 * state per surface, not a second modal component.
 */
/*
 * This used to take a `genres` list, purely to resolve a movie's primary genre
 * to a **name** before saving it. That is exactly what froze My List's "top
 * genre" stat in the saving locale, so `user_movies` stores the genre id now
 * and the name is resolved where it is displayed. Saving needs no genre list at
 * all — `MovieSummary` already carries the ids.
 */
export function useLibraryActions() {
  const [authOpen, setAuthOpen] = useState(false);
  // Real session state now — no longer a prop defaulting to "logged out".
  const { isSignedIn, isLoading: isAuthLoading } = useCurrentUser();

  /**
   * Three-way, not two.
   *
   * - **Auth still loading:** do nothing. Treating "unknown" as "logged out"
   *   would flash the login modal at a user who is in fact signed in, for as
   *   long as `/auth/me` takes to resolve.
   * - **Confirmed logged out:** open the modal. Signed-out users still see the
   *   buttons enabled and full-colour — hiding or disabling them would remove
   *   the very affordance that motivates signing up.
   * - **Signed in:** run the action for real.
   */
  const requireAuth = useCallback(
    (action: () => void) => {
      if (isAuthLoading) return;

      if (!isSignedIn) {
        setAuthOpen(true);
        return;
      }

      action();
    },
    [isAuthLoading, isSignedIn],
  );

  const add = useAddUserMovie();
  const updateStatus = useUpdateUserMovieStatus();
  const removeEntry = useRemoveUserMovie();

  /*
   * All four reach the API only via `requireAuth`, so they never fire for a
   * signed-out user. Each mutation invalidates the `['user-movies']` root key,
   * which is what makes a badge on a Discover card update after the same movie
   * was changed from its detail page.
   */
  type SavableMovie = Parameters<typeof snapshotOf>[0];

  /**
   * The movie's first genre id, as TMDB orders them — no lookup, no locale.
   *
   * Note this is `[0]`, where the name-based version walked the list for the
   * first id it could *resolve*. With ids there is nothing to resolve, so an id
   * missing from some genre list no longer silently changes which genre gets
   * stored; the display side handles an unresolvable id instead.
   */
  const primaryGenreIdOf = (movie: SavableMovie & { genreIds?: number[] }) =>
    movie.genreIds?.[0] ?? movie.primaryGenreId ?? null;

  const addToList = useCallback(
    (movie: SavableMovie) =>
      add.mutate({
        ...snapshotOf({ ...movie, primaryGenreId: primaryGenreIdOf(movie) }),
        status: "watchlist",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [add],
  );

  const removeFromList = useCallback(
    (movie: { tmdbId: number }) => removeEntry.mutate(movie.tmdbId),
    [removeEntry],
  );

  /**
   * POST, not PATCH: this is reachable from a card for a movie that may not be
   * saved yet, and PATCH 404s on a missing entry. POST is idempotent, so it
   * covers both "not saved" and "already on the watchlist".
   */
  const markWatched = useCallback(
    (movie: SavableMovie) =>
      add.mutate({
        ...snapshotOf({ ...movie, primaryGenreId: primaryGenreIdOf(movie) }),
        status: "watched",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [add],
  );

  /** Only offered on an entry that exists, so PATCH is safe here. */
  const moveBackToList = useCallback(
    (movie: { tmdbId: number }) =>
      updateStatus.mutate({ tmdbId: movie.tmdbId, status: "watchlist" }),
    [updateStatus],
  );

  /**
   * What a card's single action button does, gated.
   *
   * Mirrors `ROW_ACTIONS` in `MovieRow`: a film already on the watchlist
   * offers "Mark as watched", everything else offers "Add". Kept here rather
   * than at each call site so the branch matches the label the user sees.
   */
  const runCardAction = useCallback(
    (movie: MovieSummary) => {
      requireAuth(() => {
        if (movie.userState === "watchlist") markWatched(movie);
        else addToList(movie);
      });
    },
    [requireAuth, markWatched, addToList],
  );

  const authModal = (
    <LoginRegisterModal
      isOpen={authOpen}
      onClose={() => setAuthOpen(false)}
      defaultMode="login"
    />
  );

  return {
    /** Lets a caller show a subtle pending state while auth resolves. */
    isAuthLoading,
    /** True while any library write is in flight. */
    isMutating: add.isPending || updateStatus.isPending || removeEntry.isPending,
    isSignedIn,
    requireAuth,
    runCardAction,
    addToList,
    removeFromList,
    markWatched,
    moveBackToList,
    authModal,
  };
}
