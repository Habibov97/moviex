"use client";

import { ErrorState } from "@/components/shared/ErrorState";
import { ERROR_COPY } from "@/lib/constants/errors";

/**
 * Boundary for `/search`.
 *
 * Only fires when the search request itself throws. A successful search that
 * matched nothing is a different case entirely and keeps its own treatment —
 * `SearchEmptyState`, with the query echoed back and popular suggestions.
 */
export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState title={ERROR_COPY.searchTitle} error={error} reset={reset} />
  );
}
