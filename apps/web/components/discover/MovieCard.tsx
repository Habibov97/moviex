"use client";

import type { Movie, MovieUserState } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { DISCOVER_COPY } from "@/lib/constants/discover";

/**
 * Poster skeleton tones, in the order the design reference cycles through them.
 * Full class strings on purpose — Tailwind only sees classes it can read in the
 * source, so `bg-mx-poster-${n}` would compile to nothing.
 */
export const POSTER_TONES = [
  "bg-mx-poster-1",
  "bg-mx-poster-2",
  "bg-mx-poster-3",
  "bg-mx-poster-4",
  "bg-mx-poster-5",
  "bg-mx-poster-6",
  "bg-mx-poster-7",
  "bg-mx-poster-8",
] as const;

export function posterTone(index: number) {
  return POSTER_TONES[index % POSTER_TONES.length];
}

const STATUS_TAGS = {
  watched: { label: DISCOVER_COPY.watched, className: "bg-mx-tag-watched" },
  listed: { label: DISCOVER_COPY.listed, className: "bg-mx-tag-listed" },
} satisfies Record<MovieUserState, { label: string; className: string }>;

/** Poster geometry shared with the skeleton, so the two never drift apart. */
const posterBase =
  "relative aspect-[2/3] overflow-hidden rounded-[12px] border-[0.5px] border-mx-border-subtle";

export type MovieCardProps = {
  movie: Movie;
  /**
   * Resolved from the category list by the caller — the card never owns a genre
   * label of its own.
   */
  genreLabel?: string;
  /** Position in the grid; picks which skeleton tone the poster falls back to. */
  toneIndex?: number;
  onAdd?: (movie: Movie) => void;
  className?: string;
};

export function MovieCard({
  movie,
  genreLabel,
  toneIndex = 0,
  onAdd,
  className,
}: MovieCardProps) {
  const status = movie.userState ? STATUS_TAGS[movie.userState] : undefined;

  return (
    <article className={cn("group font-mx", className)}>
      <div className={cn(posterBase, posterTone(toneIndex))}>
        {/*
          TODO: render the artwork here once /movies serves `posterUrl` — an
          absolutely positioned, object-cover image over the tone, so a slow or
          failed load simply leaves the skeleton colour visible.
        */}

        {/* Hover scrim: dims the poster so the action below stays readable. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-mx-poster-scrim opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        />

        <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-2.5">
          {status && (
            <span
              className={cn(
                "inline-flex h-6 shrink-0 items-center rounded-[6px] px-2 text-[12px] font-medium text-mx-poster-fg",
                status.className,
              )}
            >
              {status.label}
            </span>
          )}

          <span
            className="ml-auto inline-flex h-6 shrink-0 items-center rounded-[6px] bg-mx-poster-badge px-2 text-[12px] font-medium text-mx-poster-fg tabular-nums"
            aria-label={DISCOVER_COPY.ratingLabel(movie.rating)}
          >
            {DISCOVER_COPY.rating(movie.rating)}
          </span>
        </div>

        {/*
          Revealed on hover, on keyboard focus, and permanently on devices with
          no hover at all — otherwise the action would be invisible on touch.
        */}
        <button
          type="button"
          onClick={() => onAdd?.(movie)}
          aria-label={DISCOVER_COPY.addLabel(movie.title)}
          className="absolute inset-x-2.5 bottom-2.5 flex h-8 items-center justify-center rounded-[8px] bg-mx-accent text-[13px] font-medium text-mx-on-accent opacity-0 outline-none transition-[opacity,background-color] duration-200 group-hover:opacity-100 hover:bg-mx-accent-hover focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          {DISCOVER_COPY.add}
        </button>
      </div>

      <h3 className="mt-2.5 truncate text-[15px] font-medium text-mx-fg">
        {movie.title}
      </h3>
      <p className="mt-0.5 truncate text-[13px] text-mx-fg-faint">
        {DISCOVER_COPY.movieMeta(movie.year, genreLabel)}
      </p>
    </article>
  );
}

/**
 * Loading placeholder — same geometry and same tone sequence as the real card,
 * so the grid does not reflow when the data arrives.
 */
export function MovieCardSkeleton({ toneIndex = 0 }: { toneIndex?: number }) {
  return (
    <div className="font-mx" aria-hidden="true">
      <div className={cn(posterBase, "animate-pulse", posterTone(toneIndex))} />
      <div className="mt-2.5 h-[15px] w-3/4 animate-pulse rounded-[4px] bg-mx-chip" />
      <div className="mt-1.5 h-[13px] w-1/2 animate-pulse rounded-[4px] bg-mx-chip" />
    </div>
  );
}

export default MovieCard;
