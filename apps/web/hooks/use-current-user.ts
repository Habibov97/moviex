"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API_BASE_URL } from "@/lib/api";

/**
 * What `GET /auth/me` actually returns: the **decoded JWT payload**, not a user
 * record. There is no `name` — the token carries only these four claims (see
 * `JwtPayload` in `apps/api`), so anything wanting a display name has to derive
 * it from `email` until `/auth/me` is widened to join the user row.
 */
export type CurrentUser = {
  sub: number;
  email: string;
  iat: number;
  exp: number;
};

/** The one query key for auth state. Invalidate this to re-read the session. */
export const CURRENT_USER_QUERY_KEY = ["auth", "me"] as const;

/** Auth state is not worth re-fetching on every mount. */
const CURRENT_USER_STALE_TIME = 5 * 60 * 1000;

/**
 * Who is signed in, or `null`.
 *
 * The single source of truth for auth on the client. Everything that needs to
 * know — the button gate, the navbar avatar — reads this rather than tracking
 * its own flag.
 *
 * `credentials: "include"` is mandatory: the token lives in an httpOnly cookie
 * that JS cannot read, so the browser has to be told to attach it on a
 * cross-origin request. It is also why the API's CORS must name this exact
 * origin — a wildcard is rejected in credentialed mode.
 *
 * A 401 is **not an error**, it is the logged-out answer, so it resolves to
 * `null` and `retry: false` stops React Query hammering a perfectly correct
 * rejection.
 */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async (): Promise<CurrentUser | null> => {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: "include",
      });

      // Verified against the running API: no/expired cookie → 401.
      if (response.status === 401) return null;

      if (!response.ok) {
        throw new Error(`GET /auth/me responded ${response.status}`);
      }

      return (await response.json()) as CurrentUser;
    },
    staleTime: CURRENT_USER_STALE_TIME,
    retry: false,
  });

  return {
    user: query.data ?? null,
    /**
     * True only while auth state is genuinely unknown. Callers must not treat
     * "loading" as "logged out" — that is what flashes the login modal at a
     * user who is in fact signed in.
     */
    isLoading: query.isPending,
    isSignedIn: Boolean(query.data),
  };
}

/**
 * Clears the session cookie server-side, then **drops every cached query**, so
 * nothing the previous account fetched can be read by whoever signs in next.
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["auth", "logout"],
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`POST /auth/logout responded ${response.status}`);
      }
    },
    onSettled: () => {
      /*
       * Settled, not success: if the request failed we still do not know the
       * cookie's state, so discarding is the safe move either way.
       *
       * `removeQueries()` with no filter **deletes** every cached query rather
       * than marking them stale. `invalidateQueries` — which is all this used
       * to do, and only for the auth key — leaves the data in place, so the
       * next account rendered the previous one's list straight from cache.
       *
       * Deliberately `removeQueries()` and not `queryClient.clear()`: `clear()`
       * also wipes the *mutation* cache, and this runs from inside a mutation
       * that is still settling — including the one whose `isPending` the logout
       * button is reading. Same outcome for cached data, no reaching under our
       * own feet.
       *
       * Nothing here is expensive to lose: Discover and Search render from
       * Server Components, so the only other cached queries are the navbar
       * typeahead's, which refetch on the next keystroke.
       *
       * Consumers hold live observers, so `['auth','me']` is immediately
       * refetched, answers 401, and the UI flips to signed-out on its own.
       */
      queryClient.removeQueries();
    },
  });
}

/**
 * `najaff.habibov@gmail.com` → `NA`.
 *
 * Derived from the email because the token has no name. Falls back to the
 * first two characters when the local part has no separator.
 */
export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._\-+]/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }

  return local.slice(0, 2).toUpperCase();
}
