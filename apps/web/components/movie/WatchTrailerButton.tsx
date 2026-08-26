"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import type { MovieTrailer } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { TrailerModal } from "@/components/movie/TrailerModal";

/**
 * "Watch trailer", plus the modal it opens.
 *
 * Two variants because the button sits somewhere different at each breakpoint,
 * and the two places are in different components: `compact` is the mobile pill
 * in the backdrop's top row beside Back, `full` is the desktop button on the
 * title row. Each call site hides itself at the other breakpoint with `hidden`
 * — display:none, so only one is ever rendered, clickable or in the tab order.
 *
 * The second instance is close to free: `TrailerModal` returns null while
 * closed, so a hidden one costs a `useState` and nothing else. That is why this
 * is two placements of one component rather than one placement moved around by
 * CSS — no arrangement of `position` puts a single element both in the hero's
 * top row and on a title row that lives in another component's subtree.
 */
export function WatchTrailerButton({
  trailer,
  variant,
  className,
}: {
  trailer: MovieTrailer | null;
  variant: "compact" | "full";
  className?: string;
}) {
  const t = useTranslations("detail");
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  // Unchanged: a film with no trailer renders no button at all.
  if (!trailer) return null;

  const isCompact = variant === "compact";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsTrailerOpen(true)}
        className={cn(
          "inline-flex items-center border-[0.5px] border-mx-border bg-mx-hero-pill text-mx-poster-fg outline-none transition-colors hover:border-mx-accent focus-visible:border-mx-accent",
          isCompact
            ? // Back's own measurements, copied rather than scaled down from the
              // desktop button: the two only read as a pair if the height,
              // radius, padding and type size match exactly.
              "h-8 gap-2 rounded-[8px] px-3 text-[13px]"
            : "h-11 gap-3 rounded-[8px] pr-5 pl-2.5 text-[14.5px] font-medium",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-mx-accent",
            isCompact ? "size-5" : "size-7",
          )}
        >
          <IconPlayerPlayFilled
            className={cn(
              "text-mx-on-accent",
              isCompact ? "size-2.5" : "size-3.5",
            )}
          />
        </span>
        {t("watchTrailer")}
      </button>

      <TrailerModal
        trailer={trailer}
        isOpen={isTrailerOpen}
        onClose={() => setIsTrailerOpen(false)}
      />
    </>
  );
}

export default WatchTrailerButton;
