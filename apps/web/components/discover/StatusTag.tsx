import type { MovieUserState } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { DISCOVER_COPY } from "@/lib/constants/discover";

/**
 * How the signed-in user's relationship to a film is labelled and coloured.
 * Shared by both result views — the grid card floats it over the poster, the
 * list row sets it beside the title — so the mapping lives in one place and
 * cannot drift between them.
 */
const STATUS_TAGS = {
  watched: { label: DISCOVER_COPY.watched, className: "bg-mx-tag-watched" },
  listed: { label: DISCOVER_COPY.listed, className: "bg-mx-tag-listed" },
} satisfies Record<MovieUserState, { label: string; className: string }>;

export type StatusTagProps = {
  /** Nothing renders when the film has no state (or the user is signed out). */
  state?: MovieUserState | null;
  className?: string;
};

export function StatusTag({ state, className }: StatusTagProps) {
  if (!state) return null;

  const { label, className: tone } = STATUS_TAGS[state];

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-[6px] px-2 text-[12px] font-medium text-mx-poster-fg",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}

export default StatusTag;
