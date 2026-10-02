"use client";

import { cn } from "@/lib/utils";

/**
 * One tab of the Watchlist / Watched pair, with its count pill.
 *
 * Shared by My List and the public shared-list page, so the two read as the
 * same object — it used to be a private function inside `MyListView`.
 */
export function ListTab({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "-mb-px inline-flex items-center gap-2 border-b-2 pb-2 text-[13px] outline-none transition-colors",
        isActive
          ? "border-mx-accent font-medium text-mx-fg"
          : "border-transparent text-mx-fg-faint hover:text-mx-fg-muted",
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px]",
          isActive
            ? "bg-mx-accent text-mx-on-accent"
            : "bg-mx-typeahead-active text-mx-fg-faint",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default ListTab;
