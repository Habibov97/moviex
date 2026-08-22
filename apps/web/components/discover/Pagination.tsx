import { getTranslations } from "next-intl/server";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import {
  MAX_PAGE,
  PAGE_SEARCH_PARAM,
  RESULTS_ANCHOR_ID,
} from "@/lib/constants/discover";

/** Numbers rendered around the current page, first and last included. */
const PAGE_WINDOW = 5;

type PageItem = number | "ellipsis";

/**
 * The page numbers to render, with `"ellipsis"` standing in for a collapsed
 * run. Page 1 and the last page are always present.
 *
 * Exported for its own sake — it is pure, and the windowing is the only part of
 * this component with edge cases worth reading in isolation.
 */
export function buildPageItems(current: number, total: number): PageItem[] {
  // Two ellipses would cost more slots than the pages they hide.
  if (total <= PAGE_WINDOW + 2) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);

  // Near the start: 1 2 3 4 … last  (this is the case the reference shows)
  if (current <= 3) {
    return [...range(1, 4), "ellipsis", total];
  }

  // Near the end: 1 … last-3 last-2 last-1 last
  if (current >= total - 2) {
    return [1, "ellipsis", ...range(total - 3, total)];
  }

  // Middle: 1 … current-1 current current+1 … last
  return [1, "ellipsis", ...range(current - 1, current + 1), "ellipsis", total];
}

/** 32×32 with the reference's 8px corner, shared by buttons and the ellipsis. */
const cellBase =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[12.5px]";

export type PaginationProps = {
  currentPage: number;
  /** TMDB's total; clamped to `MAX_PAGE` internally. */
  totalPages: number;
  totalResults: number;
  /**
   * The search params currently on the URL. Copied into every page link so
   * paginating never drops the active genre (or anything added later).
   */
  searchParams: Record<string, string | string[] | undefined>;
  /**
   * Route the links point at, **without** a locale prefix — the `Link` from
   * `@/i18n/navigation` adds it. Required in the href even when the query is
   * empty; see `hrefFor`.
   */
  pathname?: string;
  className?: string;
};

export async function Pagination({
  currentPage,
  totalPages,
  totalResults,
  searchParams,
  pathname = "/",
  className,
}: PaginationProps) {
  const t = await getTranslations("discover");

  // TMDB refuses anything past 500, so pages beyond it are not offered at all.
  const lastPage = Math.min(totalPages, MAX_PAGE);
  const page = Math.min(Math.max(currentPage, 1), Math.max(lastPage, 1));

  // A single page of results needs no controls.
  if (lastPage <= 1) return null;

  /**
   * Rebuilds the query string with `page` replaced, preserving every other
   * param. Page 1 drops the param instead of writing `?page=1`, matching how
   * the "All" genre chip clears rather than writes a default.
   *
   * `pathname` is always included, never omitted when the query comes out
   * empty: a bare `"#results"` href is a *fragment-only* URL, which resolves
   * against the current address and keeps its query string. That made the "1"
   * button scroll instead of navigating whenever no other filter was active —
   * the one target whose query can legitimately be empty.
   */
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (key === PAGE_SEARCH_PARAM || value === undefined) continue;
      for (const entry of Array.isArray(value) ? value : [value]) {
        params.append(key, entry);
      }
    }

    if (target > 1) params.set(PAGE_SEARCH_PARAM, String(target));

    const query = params.toString();
    // The hash scrolls the results back into view on navigation.
    return `${pathname}${query ? `?${query}` : ""}#${RESULTS_ANCHOR_ID}`;
  };

  const items = buildPageItems(page, lastPage);

  return (
    <nav
      aria-label={t("paginationLabel")}
      className={cn("w-full px-4 py-8 font-mx sm:px-6", className)}
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Arrow
          direction="prev"
          href={hrefFor(page - 1)}
          label={t("previousPage")}
          disabled={page === 1}
        />

        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className={cn(cellBase, "text-mx-page-ellipsis")}
            >
              …
            </span>
          ) : item === page ? (
            <span
              key={item}
              aria-current="page"
              className={cn(
                cellBase,
                "bg-mx-accent font-semibold text-mx-on-accent",
              )}
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={hrefFor(item)}
              aria-label={t("goToPage", { page: item })}
              className={cn(
                cellBase,
                "border-[0.5px] border-mx-border-subtle bg-mx-chip text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent",
              )}
            >
              {item}
            </Link>
          ),
        )}

        <Arrow
          direction="next"
          href={hrefFor(page + 1)}
          label={t("nextPage")}
          disabled={page === lastPage}
        />
      </div>

      {/*
        `count` goes through ICU, so the total is grouped for the locale and the
        noun agrees with it. `page`/`totalPages` are capped at 500, so they need
        no grouping of their own.
      */}
      <p className="mt-4 text-center text-[11px] text-mx-page-meta">
        {t("pageSummary", {
          page,
          totalPages: lastPage,
          count: totalResults,
        })}
      </p>
    </nav>
  );
}

/**
 * Prev/next chevron. When disabled it renders as a `<span>` rather than a
 * disabled link — there is no page to point at, so there should be no target
 * for a keyboard or screen reader to reach.
 */
function Arrow({
  direction,
  href,
  label,
  disabled,
}: {
  direction: "prev" | "next";
  href: string;
  label: string;
  disabled: boolean;
}) {
  const Icon = direction === "prev" ? IconChevronLeft : IconChevronRight;

  if (disabled) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          cellBase,
          "cursor-not-allowed text-mx-page-arrow-disabled",
        )}
      >
        <Icon className="size-4" stroke={1.75} />
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        cellBase,
        "text-mx-page-arrow outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg",
      )}
    >
      <Icon className="size-4" stroke={1.75} />
    </Link>
  );
}

export default Pagination;
