"use client";

import { useTranslations } from "next-intl";
import { IconArrowsSort, IconCheck } from "@tabler/icons-react";
import type { MovieSortId } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { useApplyFilters } from "@/hooks/use-filter-params";
import { FilterPopover } from "@/components/discover/FilterPopover";
import {
  DEFAULT_SORT_ID,
  SORT_OPTIONS,
  SORT_SEARCH_PARAM,
} from "@/lib/constants/discover";

export type SortDropdownProps = {
  /** Active ordering, parsed from the URL by the page. */
  sort: MovieSortId;
};

/**
 * Result ordering.
 *
 * Reuses `FilterPopover` purely for its trigger + open/close plumbing, but is a
 * plain menu rather than a draft popover: there is nothing to stage, so picking
 * an option commits and closes immediately. The `p-1.5` override replaces the
 * popover's roomier panel padding, since menu rows carry their own.
 *
 * Labels come from `discover.sort.<id>`, keyed by the same id the URL carries —
 * so `?sort=rating` and "Highest rated" cannot drift apart.
 */
export function SortDropdown({ sort }: SortDropdownProps) {
  const t = useTranslations("discover");
  const applyFilters = useApplyFilters();

  const activeLabel = t(`sort.${sort}`);

  return (
    <FilterPopover
      label={activeLabel}
      icon={<IconArrowsSort className="size-3.5" stroke={1.75} />}
      isActive={sort !== DEFAULT_SORT_ID}
      panelClassName="w-[200px] p-1.5"
    >
      {(close) => (
        <div role="menu" aria-label={t("sortLabel")}>
          {SORT_OPTIONS.map((option) => {
            const isSelected = option.id === sort;

            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  applyFilters({
                    // The default ordering is left out of the URL — it is what
                    // you get with no param at all.
                    [SORT_SEARCH_PARAM]:
                      option.id === DEFAULT_SORT_ID ? null : option.id,
                  });
                  close();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus-visible:bg-mx-field",
                  isSelected
                    ? "text-mx-fg"
                    : "text-mx-fg-muted hover:bg-mx-field hover:text-mx-fg",
                )}
              >
                {t(`sort.${option.id}`)}
                {isSelected && (
                  <IconCheck
                    className="ml-auto size-3.5 shrink-0 text-mx-accent"
                    stroke={2}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </FilterPopover>
  );
}

export default SortDropdown;
