"use client";

import { useCallback, useState } from "react";
import type { MovieSummary } from "@moviex/shared-types";

import { LoginRegisterModal } from "@/components/auth/LoginRegisterModal";

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
export function useLibraryActions({
  isSignedIn = false,
}: { isSignedIn?: boolean } = {}) {
  const [authOpen, setAuthOpen] = useState(false);

  /**
   * Signed-out users see the buttons exactly as a signed-in user does —
   * enabled, full-colour — and hit the auth modal on click. Hiding or disabling
   * them would remove the very affordance that motivates signing up.
   */
  const requireAuth = useCallback(
    (action: () => void) => {
      if (!isSignedIn) {
        setAuthOpen(true);
        return;
      }
      action();
    },
    [isSignedIn],
  );

  // TODO: connect to user-movies module
  const addToList = useCallback(
    (_movie: MovieSummary | { tmdbId: number }) => {},
    [],
  );
  // TODO: connect to user-movies module
  const removeFromList = useCallback(
    (_movie: MovieSummary | { tmdbId: number }) => {},
    [],
  );
  // TODO: connect to user-movies module
  const markWatched = useCallback(
    (_movie: MovieSummary | { tmdbId: number }) => {},
    [],
  );
  // TODO: connect to user-movies module
  const moveBackToList = useCallback(
    (_movie: MovieSummary | { tmdbId: number }) => {},
    [],
  );

  /**
   * What a card's single action button does, gated.
   *
   * Mirrors `ROW_ACTIONS` in `MovieRow`: a film already in the list offers
   * "Mark as watched", everything else offers "Add". Kept here rather than at
   * each call site so the branch matches the label the user actually sees.
   */
  const runCardAction = useCallback(
    (movie: MovieSummary) => {
      requireAuth(() => {
        if (movie.userState === "listed") markWatched(movie);
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
    requireAuth,
    runCardAction,
    addToList,
    removeFromList,
    markWatched,
    moveBackToList,
    authModal,
  };
}
