"use client";

import { useState } from "react";
import { IconLayoutGrid, IconLayoutList } from "@tabler/icons-react";
import type { DiscoverFilters, MovieCategory } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import {
  ALL_CATEGORY,
  DEFAULT_DISCOVER_FILTERS,
  DEFAULT_VIEW_MODE,
  DISCOVER_COPY,
  DISCOVER_LOCALE,
  MOVIE_CATEGORIES,
  PLACEHOLDER_RESULT_COUNT,
  SORT_OPTIONS,
  VIEW_MODES,
  VISIBLE_CATEGORY_COUNT,
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
   * Defaults to the placeholder catalogue. Pass the API response here once
   * `GET /movies/categories` exists — no other change is needed.
   */
  categories?: MovieCategory[];
  resultCount?: number;
  onFiltersChange?: (filters: DiscoverFilters) => void;
  onViewModeChange?: (viewMode: ViewModeId) => void;
  className?: string;
};

export function DiscoverHero({
  categories = MOVIE_CATEGORIES,
  resultCount = PLACEHOLDER_RESULT_COUNT,
  onFiltersChange,
  onViewModeChange,
  className,
}: DiscoverHeroProps) {
  const [filters, setFilters] = useState<DiscoverFilters>(
    DEFAULT_DISCOVER_FILTERS,
  );
  const [viewMode, setViewMode] = useState<ViewModeId>(DEFAULT_VIEW_MODE);
  const [isExpanded, setIsExpanded] = useState(false);

  // Selecting a collapsed genre keeps its chip on screen, so the active state is
  // never hidden behind "+N".
  const collapsed = categories.slice(0, VISIBLE_CATEGORY_COUNT);
  const selectedIsCollapsed = categories.some(
    (category) =>
      category.id === filters.categoryId &&
      !collapsed.some((visible) => visible.id === category.id),
  );
  const shownCategories = isExpanded
    ? categories
    : selectedIsCollapsed
      ? [
          ...collapsed,
          ...categories.filter((category) => category.id === filters.categoryId),
        ]
      : collapsed;
  const hiddenCount = categories.length - shownCategories.length;

  const updateFilters = (patch: Partial<DiscoverFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFiltersChange?.(next);
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
        {[ALL_CATEGORY, ...shownCategories].map((category) => {
          const isSelected = category.id === filters.categoryId;

          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => updateFilters({ categoryId: category.id })}
              className={cn(
                chipBase,
                "rounded-full border-[0.5px]",
                isSelected
                  ? "border-transparent bg-mx-accent text-mx-on-accent hover:bg-mx-accent-hover"
                  : "border-mx-border bg-mx-chip text-mx-fg-muted hover:text-mx-fg",
              )}
            >
              {category.label}
            </button>
          );
        })}

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
          <FilterChip onClick={() => {}}>
            {DISCOVER_COPY.yearRange(filters.yearFrom, filters.yearTo)}
          </FilterChip>
          <FilterChip onClick={() => {}}>
            {DISCOVER_COPY.minRating(filters.minRating)}
          </FilterChip>
          <FilterChip onClick={() => {}}>{sortLabel}</FilterChip>
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
 * Presentational for now — the reference shows no dropdown affordance and the
 * panels are not designed yet.
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
