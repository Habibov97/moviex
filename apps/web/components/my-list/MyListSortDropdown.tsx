"use client";

import { useTranslations } from "next-intl";
import { IconArrowsSort, IconCheck } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { FilterPopover } from "@/components/discover/FilterPopover";
import {
  DEFAULT_LIST_SORT,
  LIST_SORT_OPTIONS,
  type ListSortId,
} from "@/lib/constants/my-list";

/**
 * My List's sort control.
 *
 * Same shape as Discover's `SortDropdown` — `FilterPopover` for the trigger and
 * open/close plumbing, a plain menu inside, commit-on-click with no Apply. The
 * difference is only where the selection goes: this one sorts an in-memory
 * list rather than reaching for TMDB.
 */
export function MyListSortDropdown({
  sort,
  onChange,
}: {
  sort: ListSortId;
  onChange: (sort: ListSortId) => void;
}) {
  const t = useTranslations("myList");

  return (
    <FilterPopover
      label={t(`sort.${sort}`)}
      icon={<IconArrowsSort className="size-3.5" stroke={1.75} />}
      isActive={sort !== DEFAULT_LIST_SORT}
      panelClassName="w-[200px] p-1.5"
    >
      {(close) => (
        <div role="menu" aria-label={t(`sort.${sort}`)}>
          {LIST_SORT_OPTIONS.map((option) => {
            const isSelected = option === sort;

            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onChange(option);
                  close();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus-visible:bg-mx-field",
                  isSelected
                    ? "text-mx-fg"
                    : "text-mx-fg-muted hover:bg-mx-field hover:text-mx-fg",
                )}
              >
                {t(`sort.${option}`)}
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

export default MyListSortDropdown;
