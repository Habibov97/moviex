"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconDots,
  IconTrash,
} from "@tabler/icons-react";
import type { UserMovie } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { posterTone } from "@/lib/poster-tone";
import { movieHref } from "@/lib/constants/discover";
import { MY_LIST_COPY, formatListDate } from "@/lib/constants/my-list";

export type MyListCardProps = {
  entry: UserMovie;
  toneIndex: number;
  onMarkWatched: (entry: UserMovie) => void;
  onRemove: (entry: UserMovie) => void;
};

/**
 * A saved movie.
 *
 * Deliberately *not* the Discover card: no permanent overlay button on the
 * face. The poster stays clean, and the actions appear on hover — this is a
 * personal shelf, not a place to keep adding things.
 *
 * Touch devices get a `⋯` button instead, because a hover-only affordance is
 * unreachable there.
 */
export function MyListCard({
  entry,
  toneIndex,
  onMarkWatched,
  onRemove,
}: MyListCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isWatched = entry.status === "watched";

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Watchlist shows when it was saved; Watched shows when it was seen.
  const caption = isWatched
    ? formatListDate(entry.watchedAt ?? entry.updatedAt)
    : formatListDate(entry.createdAt);

  return (
    <article ref={containerRef} className="group relative font-mx">
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-[12px] border-[0.5px] border-mx-border-subtle",
          posterTone(toneIndex),
        )}
      >
        {entry.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.posterUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        )}

        {/* Persistent, unlike the hover actions: it states what this is. */}
        {isWatched && (
          <span
            aria-hidden="true"
            className="absolute top-2 left-2 z-10 flex size-5 items-center justify-center rounded-full bg-mx-state-watched-border"
          >
            <IconCheck className="size-3 text-mx-state-watched-fg" stroke={2.5} />
          </span>
        )}

        {/* The whole poster is the link; actions sit above it. */}
        <Link
          href={movieHref(entry.tmdbId)}
          className="absolute inset-0 z-0 outline-none focus-visible:ring-1 focus-visible:ring-mx-accent"
        >
          <span className="sr-only">{entry.title}</span>
        </Link>

        {/*
          Hover only, and only where hover exists — `[@media(hover:hover)]`
          keeps this off touch devices, which use the ⋯ menu instead.
        */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-mx-card-overlay opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:hidden">
          {!isWatched && (
            <button
              type="button"
              onClick={() => onMarkWatched(entry)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-mx-accent px-3 text-[12.5px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover"
            >
              <IconCheck className="size-3.5" stroke={2} />
              {MY_LIST_COPY.markWatched}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(entry)}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border-[0.5px] border-mx-border bg-transparent px-3 text-[12.5px] font-medium text-mx-poster-fg outline-none transition-colors hover:border-mx-accent"
          >
            <IconTrash className="size-3.5" stroke={1.75} />
            {MY_LIST_COPY.remove}
          </button>
        </div>

        {/* Touch-only counterpart to the hover overlay. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={MY_LIST_COPY.moreActions}
          aria-expanded={menuOpen}
          className="absolute top-2 right-2 z-20 flex size-7 items-center justify-center rounded-full bg-mx-hero-pill text-mx-poster-fg outline-none [@media(hover:hover)]:hidden"
        >
          <IconDots className="size-4" stroke={2} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute top-10 right-2 z-30 w-36 rounded-[10px] border-[0.5px] border-mx-border bg-mx-card p-1.5 shadow-lg [@media(hover:hover)]:hidden"
          >
            {!isWatched && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onMarkWatched(entry);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-mx-fg-muted outline-none transition-colors hover:bg-mx-field hover:text-mx-fg"
              >
                <IconCheck className="size-3.5" stroke={2} />
                {MY_LIST_COPY.markWatched}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onRemove(entry);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-mx-fg-muted outline-none transition-colors hover:bg-mx-field hover:text-mx-fg"
            >
              <IconTrash className="size-3.5" stroke={1.75} />
              {MY_LIST_COPY.remove}
            </button>
          </div>
        )}
      </div>

      <h3 className="mt-2.5 truncate text-[12.5px] font-medium text-mx-fg">
        {entry.title}
      </h3>
      {caption && (
        <p className="mt-0.5 truncate text-[10.5px] text-mx-page-meta">
          {isWatched
            ? MY_LIST_COPY.watchedOn(caption)
            : MY_LIST_COPY.addedOn(caption)}
        </p>
      )}
    </article>
  );
}

export default MyListCard;
