"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconLayoutGrid, IconLayoutList } from "@tabler/icons-react";
import type { DiscoverFilters, Genre } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import {
  ALL_GENRE_LABEL,
  DEFAULT_DISCOVER_FILTERS,
  DEFAULT_VIEW_MODE,
  DISCOVER_COPY,
  DISCOVER_LOCALE,
  GENRE_SEARCH_PARAM,
  PAGE_SEARCH_PARAM,
  SORT_OPTIONS,
  VIEW_MODES,
  VISIBLE_GENRE_COUNT,
  type ViewModeId,
} from "@/lib/constants/discover";

const VIEW_MODE_ICONS = {
  grid: IconLayoutGrid,
  list: IconLayoutList,
} satisfies Record<ViewModeId, typeof IconLayoutGrid>;

/** Shared chip geometry — the two variants differ only in surface and radius. */
const chipBase =
  "inline-flex h-7 shrink-0 items-center px-3 text-[13px] outline-none transition-colors focus-visible:border-mx-accent";

export type DiscoverHeroProps = {
  /**
   * The live TMDB genre list, fetched server-side. No default value: there is
   * no hard-coded genre list to fall back to, and an empty array simply renders
   * the "Tümü" chip on its own.
   */
  genres: Genre[];
  /**
   * Currently selected TMDB genre id, read from the `genre` search param by the
   * page. `null` means "Tümü". The URL is the source of truth, so this arrives
   * as a prop rather than living in local state.
   */
  selectedGenreId: number | null;
  /** TMDB's total match count for the active filter. */
  resultCount: number;
  onFiltersChange?: (filters: DiscoverFilters) => void;
  onViewModeChange?: (viewMode: ViewModeId) => void;
  className?: string;
};

export function DiscoverHero({
  genres,
  selectedGenreId,
  resultCount,
  onFiltersChange,
  onViewModeChange,
  className,
}: DiscoverHeroProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Genre lives in the URL; year/rating/sort are still local, exactly as they
  // were — their panels are not designed yet.
  const [filters, setFilters] = useState<DiscoverFilters>(
    DEFAULT_DISCOVER_FILTERS,
  );
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
   * Writes the selection to the URL rather than to state. `null` (the "Tümü"
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
    onFiltersChange?.({ ...filters, genreId });
  };

  const updateFilters = (patch: Partial<DiscoverFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFiltersChange?.({ ...next, genreId: selectedGenreId });
  };

  const selectViewMode = (next: ViewModeId) => {
    setViewMode(next);
    onViewModeChange?.(next);
  };

  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === filters.sort)?.label ?? "";
  const formattedCount = new Intl.NumberFormat(DISCOVER_LOCALE).format(
    resultCount,
  );

  return (
    <section
      aria-labelledby="discover-title"
      className={cn(
        "w-full border-b-[0.5px] border-mx-border-subtle bg-mx-bg px-4 py-5 font-mx sm:px-6",
        className,
      )}
    >
      <h1
        id="discover-title"
        className="text-2xl font-semibold tracking-tight text-mx-fg"
      >
        {DISCOVER_COPY.title}
      </h1>

      <div className="mt-1 flex items-baseline gap-4">
        <p className="min-w-0 flex-1 text-[14px] text-mx-fg-subtle">
          {DISCOVER_COPY.subtitle}
        </p>
        <span className="shrink-0 text-[13px] whitespace-nowrap text-mx-fg-faint">
          {DISCOVER_COPY.results(formattedCount)}
        </span>
      </div>

      <div
        role="group"
        aria-label={DISCOVER_COPY.categoriesLabel}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        {/* Not a TMDB genre — it clears the filter rather than applying one. */}
        <GenreChip
          label={ALL_GENRE_LABEL}
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
                ? DISCOVER_COPY.showLess
                : DISCOVER_COPY.showMoreLabel(hiddenCount)
            }
            onClick={() => setIsExpanded((current) => !current)}
            className={cn(
              chipBase,
              "rounded-full border-[0.5px] border-mx-border bg-mx-chip text-mx-fg-faint hover:text-mx-fg-muted",
            )}
          >
            {isExpanded
              ? DISCOVER_COPY.showLess
              : DISCOVER_COPY.showMore(hiddenCount)}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={DISCOVER_COPY.filtersLabel}
          className="flex flex-wrap items-center gap-2"
        >
          <FilterChip onClick={() => updateFilters({})}>
            {DISCOVER_COPY.yearRange(filters.yearFrom, filters.yearTo)}
          </FilterChip>
          <FilterChip onClick={() => updateFilters({})}>
            {DISCOVER_COPY.minRating(filters.minRating)}
          </FilterChip>
          <FilterChip onClick={() => updateFilters({})}>{sortLabel}</FilterChip>
        </div>

        <div
          role="group"
          aria-label={DISCOVER_COPY.viewLabel}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full border-[0.5px] border-mx-border-subtle bg-mx-chip-alt p-0.5"
        >
          {VIEW_MODES.map((mode) => {
            const Icon = VIEW_MODE_ICONS[mode.id];
            const isSelected = mode.id === viewMode;

            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={mode.label}
                onClick={() => selectViewMode(mode.id)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full outline-none transition-colors",
                  isSelected
                    ? "bg-mx-avatar text-mx-fg"
                    : "text-mx-fg-faint hover:text-mx-fg-muted",
                )}
              >
                <Icon className="size-3.5" stroke={1.75} />
              </button>
            );
          })}
        </div>
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

/**
 * Presentational for now — the reference shows no dropdown affordance and the
 * panels are not designed yet. Unlike the genre chips, these do not write to
 * the URL.
 */
function FilterChip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // TODO: open the matching filter panel
      onClick={onClick}
      className={cn(
        chipBase,
        "rounded-[8px] border-[0.5px] border-mx-border-subtle bg-mx-chip-alt text-mx-fg-muted hover:text-mx-fg",
      )}
    >
      {children}
    </button>
  );
}

export default DiscoverHero;
