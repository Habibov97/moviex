"use client";

import { useSearchParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";
import { PAGE_SEARCH_PARAM } from "@/lib/constants/discover";

/**
 * Commits a filter change to the URL, which is what re-runs the Server
 * Component's fetch.
 *
 * Merges into the params already on the URL, so applying a year range never
 * drops the active genre. `null` removes a param rather than writing an empty
 * value, keeping a cleared filter out of the URL entirely.
 *
 * Always resets `page`: the old page number is meaningless against a different
 * result set, and a narrower filter may not even have that many pages.
 *
 * `usePathname` / `useRouter` come from `@/i18n/navigation`: the pathname
 * arrives locale-free, and the push re-adds the active prefix — so applying a
 * filter never drops the user back into the default language.
 */
export function useApplyFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    params.delete(PAGE_SEARCH_PARAM);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
}
