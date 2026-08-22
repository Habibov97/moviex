"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { ERROR_COPY } from "@/lib/constants/errors";

/**
 * Boundary for a movie detail page.
 *
 * Distinct from the root boundary only in wording — "this movie" rather than
 * "movies". An unknown id is *not* handled here: the page calls `notFound()`
 * for that, which renders `not-found`, not an error.
 */
export default function MovieError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState title={ERROR_COPY.movieTitle} error={error} reset={reset} />
  );
}
