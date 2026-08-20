"use client";

import { useState } from "react";
import {
  IconStar,
  IconStarFilled,
  IconStarHalfFilled,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { useApplyFilters } from "@/hooks/use-filter-params";
import {
  FilterPopover,
  PopoverActions,
  PopoverHeader,
} from "@/components/discover/FilterPopover";
import {
  DISCOVER_COPY,
  MIN_RATING_SEARCH_PARAM,
  RATING_OPTIONS,
} from "@/lib/constants/discover";

const STAR_COUNT = 5;

/**
 * TMDB scores out of 10, the stars read out of 5 — so the threshold halves.
 * `7 → 3.5` renders as three filled, one half, one empty.
 */
function starKinds(rating: number) {
  const value = rating / 2;

  return Array.from({ length: STAR_COUNT }, (_, index) => {
    if (index + 1 <= value) return "full" as const;
    return value - index >= 0.5 ? ("half" as const) : ("empty" as const);
  });
}

export type RatingFilterPopoverProps = {
  /** Applied threshold from the URL; `null` is "Any rating". */
  minRating: number | null;
};

export function RatingFilterPopover({ minRating }: RatingFilterPopoverProps) {
  const applyFilters = useApplyFilters();

  // Draft only — see YearFilterPopover; discarded unless "Apply" is clicked.
  const [draft, setDraft] = useState<number | null>(minRating);

  return (
    <FilterPopover
      label={
        minRating === null
          ? DISCOVER_COPY.ratingChip
          : DISCOVER_COPY.ratingChipValue(minRating)
      }
      icon={<IconStar className="size-3.5" stroke={1.75} />}
      isActive={minRating !== null}
      panelClassName="w-[260px]"
      onOpenChange={(open) => {
        if (open) setDraft(minRating);
      }}
    >
      {(close) => (
        <>
          <PopoverHeader
            title={DISCOVER_COPY.ratingTitle}
            subtitle={DISCOVER_COPY.ratingSubtitle}
          />

          {/* Radio semantics: exactly one threshold is active at a time. */}
          <div role="radiogroup" aria-label={DISCOVER_COPY.ratingTitle}>
            <div className="flex flex-col gap-2">
              {RATING_OPTIONS.map((option) => {
                const isSelected = draft === option;

                return (
                  <button
                    key={option ?? "any"}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setDraft(option)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] outline-none transition-colors focus-visible:border-mx-accent",
                      isSelected
                        ? "border border-mx-accent bg-mx-option-selected text-mx-fg"
                        : "border border-transparent bg-mx-field text-mx-fg-muted hover:text-mx-fg",
                    )}
                  >
                    {option === null ? (
                      <span>{DISCOVER_COPY.anyRating}</span>
                    ) : (
                      <>
                        <span aria-hidden="true" className="flex items-center gap-0.5">
                          {starKinds(option).map((kind, index) => {
                            const Star =
                              kind === "full"
                                ? IconStarFilled
                                : kind === "half"
                                  ? IconStarHalfFilled
                                  : IconStar;

                            return (
                              <Star
                                key={index}
                                className={cn(
                                  "size-3.5",
                                  kind === "empty"
                                    ? "text-mx-fg-faint"
                                    : "text-mx-accent",
                                )}
                                stroke={1.75}
                              />
                            );
                          })}
                        </span>
                        <span>{DISCOVER_COPY.ratingChipValue(option)}</span>
                      </>
                    )}

                    {/* Radio dot sits at the row's end, as in the reference. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "ml-auto flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-mx-accent bg-mx-accent"
                          : "border-mx-avatar-border",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <PopoverActions
            onReset={() => setDraft(null)}
            onApply={() => {
              applyFilters({
                // "Any rating" removes the param rather than writing a 0 floor.
                [MIN_RATING_SEARCH_PARAM]:
                  draft === null ? null : String(draft),
              });
              close();
            }}
          />
        </>
      )}
    </FilterPopover>
  );
}

export default RatingFilterPopover;
