"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { ERROR_COPY } from "@/lib/constants/errors";

/**
 * Boundary for the Discover page.
 *
 * It sits at `app/`, not `app/discover/`, because Discover **is** the root
 * route (`app/page.tsx`) — there is no `/discover` segment; `NAV_LINKS` points
 * "Discover" at `/`.
 *
 * Being the root boundary, it also catches any child segment that has no
 * `error.tsx` of its own — currently `/movie/[tmdbId]`. It does *not* catch
 * errors thrown by `app/layout.tsx` itself; that would need `global-error.tsx`.
 */
export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState title={ERROR_COPY.discoverTitle} error={error} reset={reset} />
  );
}
