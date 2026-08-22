"use client";

import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/shared/ErrorState";

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
  const t = useTranslations("errors");

  return <ErrorState title={t("movieTitle")} error={error} reset={reset} />;
}
