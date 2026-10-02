"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { WAKE_PATH, type WakeStatus } from "@/lib/server-status";

/**
 * - `checking` — the first answer has not arrived yet. Shows nothing: a warm
 *   API answers in a fraction of a second, and a banner that flashes up and
 *   away on every page load would be noise.
 * - `up` / `waking` — what `/api/wake` said.
 * - `unavailable` — still not up after `MAX_ATTEMPTS`; polling stops.
 */
export type ServerStatus = "checking" | WakeStatus | "unavailable";

/** Pause between polls while waking. Each poll can itself take up to 5s. */
const POLL_INTERVAL_MS = 3_000;

/**
 * ~15 polls × (3s pause + up to 5s per request) ≈ 2 minutes. A Render cold
 * start is 30–50s, so anything past this is not a cold start any more.
 */
const MAX_ATTEMPTS = 15;

/**
 * Whether the API is awake, polled until it is.
 *
 * Mounted once, from the layout, so it runs per full page load and not per
 * client-side navigation — the layout survives those. Not user-scoped data, so
 * the key carries no user id (compare `userMoviesKey`).
 */
export function useServerStatus(): ServerStatus {
  // Counted inside the query function rather than derived from time during
  // render, which keeps render pure.
  const attemptsRef = useRef(0);

  const query = useQuery({
    queryKey: ["server-status"],
    queryFn: async (): Promise<ServerStatus> => {
      attemptsRef.current += 1;

      let status: WakeStatus = "waking";
      try {
        const response = await fetch(WAKE_PATH, { cache: "no-store" });
        const body = (await response.json()) as { status?: WakeStatus };
        if (body.status === "up") status = "up";
      } catch {
        // The Next server itself unreachable, or a non-JSON body: treat as
        // still waking and let the attempt ceiling decide.
      }

      if (status === "waking" && attemptsRef.current >= MAX_ATTEMPTS) {
        return "unavailable";
      }
      return status;
    },
    // Keep polling only while waking. `up` and `unavailable` are final.
    refetchInterval: (q) =>
      q.state.data === "waking" ? POLL_INTERVAL_MS : false,
    // The route already turns every failure into `waking`; a React Query
    // retry on top would only stack a second backoff onto the poll.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return query.data ?? "checking";
}
