"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API_BASE_URL } from "@/lib/api";

/**
 * What `GET /auth/me` returns.
 *
 * `sub`, `iat` and `exp` come from the token; **`userName` is joined from the
 * `users` row** by the API, because the token deliberately does not carry it
 * (it rides on every request, so it stays small). That join is what lets the
 * UI show a real username instead of deriving something from the email.
 */
export type CurrentUser = {
  sub: number;
  email: string;
  /** The account's username — the same value the register form collects. */
  userName: string;
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
       * `removeQueries` **deletes** cached data rather than marking it stale.
       * `invalidateQueries` — which is all this used to do, and only for the
       * auth key — leaves the data in place, so the next account rendered the
       * previous one's list straight from cache.
       *
       * Deliberately not `queryClient.clear()`: `clear()` also wipes the
       * *mutation* cache, and this runs from inside a mutation that is still
       * settling — including the one whose `isPending` the logout button is
       * reading. Same outcome for cached data, no reaching under our own feet.
       *
       * **`['auth','me']` is deliberately exempt from the removal, and that
       * exemption is load-bearing.** Removing a query destroys the cache entry
       * but does *not* clear the data a mounted observer is already rendering,
       * and it leaves nothing behind for `invalidateQueries` to match — that
       * call only refetches queries the cache still holds. So an unfiltered
       * `removeQueries()` froze `useCurrentUser` on the departing user
       * indefinitely: `/auth/me` was never re-requested, `user.sub` stayed the
       * old id, and every badge keyed by `userMoviesKey(user?.sub)` kept
       * rendering that account's saved state until something remounted the
       * tree. Worse, the next login's `invalidateQueries(['auth','me'])` also
       * matched nothing, so signing in as someone else did not fix it either.
       * Verified against query-core: the `/auth/me` fetch count stayed at 1
       * across a full logout → login cycle.
       *
       * Nothing else here is expensive to lose: Discover and Search render from
       * Server Components, so the only other cached queries are the navbar
       * typeahead's, which refetch on the next keystroke.
       */
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== CURRENT_USER_QUERY_KEY[0],
      });

      /*
       * Say so immediately — the cookie is gone, so signed-out is already true
       * and there is no honest reason to keep showing the previous identity
       * while a round trip confirms it. This is also what blanks the badges in
       * the same tick rather than after `/auth/me` answers.
       */
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);

      // Then re-verify against the server. Matches now, because the query was
      // left in the cache above.
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });
}

/**
 * The avatar's initials: `najaf` → `NA`, `ada.lovelace` → `AL`.
 *
 * Takes the **username** now that `/auth/me` supplies one; it used to take the
 * email local part, which was a stand-in for a field the API did not yet
 * return. The splitting rule is unchanged, so a separator-bearing value still
 * yields one letter per part and anything else falls back to its first two
 * characters.
 */
export function initialsFrom(value: string): string {
  const parts = value.split(/[._\-+\s]/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}
