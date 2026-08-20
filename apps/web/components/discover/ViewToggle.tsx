"use client";

import { IconLayoutGrid, IconLayoutList } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  DISCOVER_COPY,
  VIEW_MODES,
  type ViewModeId,
} from "@/lib/constants/discover";

const VIEW_MODE_ICONS = {
  grid: IconLayoutGrid,
  list: IconLayoutList,
} satisfies Record<ViewModeId, typeof IconLayoutGrid>;

/**
 * Grid/list segmented control. Controlled and presentational — it owns no
 * state, so Discover and Search can each decide where the selection lives
 * while rendering the identical control.
 */
export function ViewToggle({
  value,
  onChange,
  className,
}: {
  value: ViewModeId;
  onChange: (viewMode: ViewModeId) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={DISCOVER_COPY.viewLabel}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full border-[0.5px] border-mx-border-subtle bg-mx-chip-alt p-0.5",
        className,
      )}
    >
      {VIEW_MODES.map((mode) => {
        const Icon = VIEW_MODE_ICONS[mode.id];
        const isSelected = mode.id === value;

        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={isSelected}
            aria-label={mode.label}
            onClick={() => onChange(mode.id)}
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
  );
}

export default ViewToggle;
