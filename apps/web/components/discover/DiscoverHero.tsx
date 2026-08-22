"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { Genre, MovieSortId } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "@/i18n/navigation";
import { YearFilterPopover } from "@/components/discover/YearFilterPopover";
import { RatingFilterPopover } from "@/components/discover/RatingFilterPopover";
import { SortDropdown } from "@/components/discover/SortDropdown";
import { ViewToggle } from "@/components/discover/ViewToggle";
import { PageHeading } from "@/components/shared/PageHeading";
import {
  DEFAULT_VIEW_MODE,
  GENRE_SEARCH_PARAM,
  PAGE_SEARCH_PARAM,
  VISIBLE_GENRE_COUNT,
  type ViewModeId,
} from "@/lib/constants/discover";

/** Ties the filter row's heading to its group for assistive tech. */
const FILTERS_HEADING_ID = "discover-filters-heading";

/** Shared chip geometry — the two variants differ only in surface and radius. */
const chipBase =
  "inline-flex h-7 shrink-0 items-center px-3 text-[13px] outline-none transition-colors focus-visible:border-mx-accent";

export type DiscoverHeroProps = {
  /**
   * The live TMDB genre list, fetched server-side **in the active locale** —
   * genre names are catalogue data, translated by TMDB rather than by our
   * message files. No default value: there is no hard-coded genre list to fall
   * back to, and an empty array simply renders the "All" chip on its own.
   */
  genres: Genre[];
  /**
   * Currently selected TMDB genre id, read from the `genre` search param by the
   * page. `null` means "All". The URL is the source of truth, so this arrives
   * as a prop rather than living in local state.
   */
  selectedGenreId: number | null;
  /** TMDB's total match count for the active filter. */
  resultCount: number;
  /** Applied release-year range, parsed from the URL by the page. */
  yearFrom: number;
  yearTo: number;
  /** Applied minimum score, or `null` for "Any rating". */
  minRating: number | null;
  /** Active result ordering, parsed from the URL by the page. */
  sort: MovieSortId;
  onViewModeChange?: (viewMode: ViewModeId) => void;
  className?: string;
};

export function DiscoverHero({
  genres,
  selectedGenreId,
  resultCount,
  yearFrom,
  yearTo,
  minRating,
  sort,
  onViewModeChange,
  className,
}: DiscoverHeroProps) {
  const t = useTranslations("discover");
  const router = useRouter();
  // Locale-free (`/`), so the pushes below rebuild a plain path and the
  // navigation helper re-adds the prefix.
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewModeId>(DEFAULT_VIEW_MODE);
  const [isExpanded, setIsExpanded] = useState(false);

  // Selecting a collapsed genre keeps its chip on screen, so the active state is
  // never hidden behind "+N".
  const collapsed = genres.slice(0, VISIBLE_GENRE_COUNT);
  const selectedIsCollapsed = genres.some(
    (genre) =>
      genre.id === selectedGenreId &&
      !collapsed.some((visible) => visible.id === genre.id),
  );
  const shownGenres = isExpanded
    ? genres
    : selectedIsCollapsed
      ? [...collapsed, ...genres.filter((genre) => genre.id === selectedGenreId)]
      : collapsed;
  const hiddenCount = genres.length - shownGenres.length;

  /**
   * Writes the selection to the URL rather than to state. `null` (the "All"
   * chip) drops the param entirely instead of writing an "all" sentinel, so a
   * cleared filter leaves a clean URL. Any other params are preserved.
   */
  const selectGenre = (genreId: number | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (genreId === null) {
      params.delete(GENRE_SEARCH_PARAM);
    } else {
      params.set(GENRE_SEARCH_PARAM, String(genreId));
    }

    /*
     * Changing the filter changes the result set, so the old page number is
     * meaningless against it — page 5 of Action has no relationship to page 5
     * of Documentary, and a narrow genre may not even have five pages. Dropping
     * the param resets to page 1. The pagination's own links do the opposite
     * and preserve `genre`.
     */
    params.delete(PAGE_SEARCH_PARAM);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const selectViewMode = (next: ViewModeId) => {
    setViewMode(next);
    onViewModeChange?.(next);
  };

  return (
    <section
      aria-labelledby="discover-title"
      className={cn(
        "w-full border-b-[0.5px] border-mx-border-subtle bg-mx-bg px-4 py-5 font-mx sm:px-6",
        className,
      )}
    >
      <PageHeading
        id="discover-title"
        title={t("title")}
        description={t("subtitle")}
        aside={
          /*
            The count goes through ICU as `{count, plural, …}`, so `#` is
            grouped for the active locale and the noun agrees with it — Russian
            needs three forms where English needs two.
          */
          <span className="shrink-0 text-[13px] whitespace-nowrap text-mx-fg-faint">
            {t("results", { count: resultCount })}
          </span>
        }
      />

      <div
        role="group"
        aria-label={t("genresLabel")}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        {/* Not a TMDB genre — it clears the filter rather than applying one. */}
        <GenreChip
          label={t("allGenres")}
          isSelected={selectedGenreId === null}
          onClick={() => selectGenre(null)}
        />

        {shownGenres.map((genre) => (
          <GenreChip
            key={genre.id}
            label={genre.name}
            isSelected={genre.id === selectedGenreId}
            onClick={() => selectGenre(genre.id)}
          />
        ))}

        {(hiddenCount > 0 || isExpanded) && (
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? t("showLess")
                : t("showMoreLabel", { count: hiddenCount })
            }
            onClick={() => setIsExpanded((current) => !current)}
            className={cn(
              chipBase,
              "rounded-full border-[0.5px] border-mx-border bg-mx-chip text-mx-fg-faint hover:text-mx-fg-muted",
            )}
          >
            {isExpanded
              ? t("showLess")
              : t("showMore", { count: hiddenCount })}
          </button>
        )}
      </div>

      {/*
        Its own labelled group, set off from the genre chips above — without the
        heading the two rows read as one long block of pills.
      */}
      <h2
        id={FILTERS_HEADING_ID}
        className="mt-5 text-[12px] font-medium text-mx-fg-subtle"
      >
        {t("filtersLabel")}
      </h2>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-labelledby={FILTERS_HEADING_ID}
          className="flex flex-wrap items-center gap-2"
        >
          <YearFilterPopover from={yearFrom} to={yearTo} />
          <RatingFilterPopover minRating={minRating} />
          <SortDropdown sort={sort} />
        </div>

        <ViewToggle
          value={viewMode}
          onChange={selectViewMode}
          className="ml-auto"
        />
      </div>
    </section>
  );
}

/**
 * The pill-shaped genre chip. Styling is byte-for-byte what the static version
 * used — only the data source changed.
 */
function GenreChip({
  label,
  isSelected,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        chipBase,
        "rounded-full border-[0.5px]",
        isSelected
          ? "border-transparent bg-mx-accent text-mx-on-accent hover:bg-mx-accent-hover"
          : "border-mx-border bg-mx-chip text-mx-fg-muted hover:text-mx-fg",
      )}
    >
      {label}
    </button>
  );
}

export default DiscoverHero;
