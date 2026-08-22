"use client";

import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/shared/ErrorState";

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
  const t = useTranslations("errors");

  return <ErrorState title={t("searchTitle")} error={error} reset={reset} />;
}
