"use client";

import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/shared/ErrorState";

/**
 * Boundary for the Discover page.
 *
 * It sits at `app/[locale]/`, not `app/[locale]/discover/`, because Discover
 * **is** the root route (`app/[locale]/page.tsx`) — there is no `/discover`
 * segment; `NAV_LINKS` points "Discover" at `/`.
 *
 * Being the root boundary, it also catches any child segment that has no
 * `error.tsx` of its own — currently `/my-list`. It does *not* catch errors
 * thrown by the layout itself; that would need `global-error.tsx`.
 *
 * It sits *inside* `[locale]`, so `NextIntlClientProvider` from the layout is
 * above it and `useTranslations` works here. A boundary at `app/` would render
 * outside the provider and could only show untranslated text.
 */
export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return <ErrorState title={t("discoverTitle")} error={error} reset={reset} />;
}
