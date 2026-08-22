"use client";

import { useTranslations } from "next-intl";
import type { MovieUserState } from "@moviex/shared-types";

import { cn } from "@/lib/utils";

/**
 * How the signed-in user's relationship to a film is coloured, and which
 * message names it. Shared by both result views — the grid card floats it over
 * the poster, the list row sets it beside the title — so the mapping lives in
 * one place and cannot drift between them.
 */
const STATUS_TAGS = {
  watched: { messageKey: "tagWatched", className: "bg-mx-tag-watched" },
  watchlist: { messageKey: "tagListed", className: "bg-mx-tag-listed" },
} satisfies Record<MovieUserState, { messageKey: string; className: string }>;

export type StatusTagProps = {
  /** Nothing renders when the film has no state (or the user is signed out). */
  state?: MovieUserState | null;
  className?: string;
};

export function StatusTag({ state, className }: StatusTagProps) {
  const t = useTranslations("discover");

  if (!state) return null;

  const { messageKey, className: tone } = STATUS_TAGS[state];

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-[6px] px-2 text-[12px] font-medium text-mx-poster-fg",
        tone,
        className,
      )}
    >
      {t(messageKey)}
    </span>
  );
}

export default StatusTag;
