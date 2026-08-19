"use client";

import type { MovieSummary, MovieUserState } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { StatusTag } from "@/components/discover/StatusTag";
import { posterTone } from "@/components/discover/MovieCard";
import { DISCOVER_COPY } from "@/lib/constants/discover";

type RowAction = {
  label: string;
  ariaLabel: (title: string) => string;
  className: string;
};

/** Adds the film to Listem. The accent-filled call to action. */
const ADD_ACTION: RowAction = {
  label: DISCOVER_COPY.add,
  ariaLabel: DISCOVER_COPY.addLabel,
  className:
    "border-transparent bg-mx-accent text-mx-on-accent hover:bg-mx-accent-hover",
};

/**
 * Every row has an action — no state leaves the button slot empty.
 *
 * Only a film already in Listem swaps `Ekle` for the quieter `İzledim`, which
 * is the one step available from there. A watched film keeps `Ekle`: Listem and
 * İzlediklerim are separate lists, so having seen a film does not put it in the
 * list. There is no rating action in this flow.
 */
const ROW_ACTIONS = {
  none: ADD_ACTION,
  watched: ADD_ACTION,
  listed: {
    label: DISCOVER_COPY.markWatched,
    ariaLabel: DISCOVER_COPY.markWatchedLabel,
    className:
      "border-mx-border bg-transparent text-mx-fg-muted hover:text-mx-fg",
  },
} satisfies Record<MovieUserState | "none", RowAction>;

/** Poster geometry shared with the skeleton, so the two never drift apart. */
const posterBase =
  "w-16 shrink-0 overflow-hidden rounded-[10px] border-[0.5px] border-mx-border-subtle sm:w-20";

/** Reserved so the buttons form one column no matter which label they carry. */
const actionWidth = "w-full sm:w-[124px]";

export type MovieRowProps = {
  movie: MovieSummary;
  /** 1-based; rendered zero-padded as the row's rank. */
  position: number;
  /**
   * Resolved from the category list by the caller — the row never owns a genre
   * label of its own.
   */
  genreLabel?: string;
  /** Position in the list; picks which skeleton tone the poster falls back to. */
  toneIndex?: number;
  /** Fired for whichever action the film's current state offers. */
  onAction?: (movie: MovieSummary) => void;
  className?: string;
};

export function MovieRow({
  movie,
  position,
  genreLabel,
  toneIndex = 0,
  onAction,
  className,
}: MovieRowProps) {
  const action = ROW_ACTIONS[movie.userState ?? "none"];
  // No runtime: TMDB's discover endpoint doesn't return it, so the meta line
  // is just "year · genre" until a details call fills it in.

  return (
    <article
      className={cn(
        "flex items-center gap-3 px-4 py-5 transition-colors hover:bg-mx-chip sm:gap-5 sm:px-6",
        className,
      )}
    >
      {/* Decorative: the rank restates list order, which the markup already carries. */}
      <span
        aria-hidden="true"
        className="hidden w-7 shrink-0 text-[13px] text-mx-fg-faint tabular-nums sm:block"
      >
        {DISCOVER_COPY.rank(position)}
      </span>

      <div className={cn(posterBase, "relative", posterTone(toneIndex))}>
        {/* Layered over the tone — see MovieCard for why it is a plain <img>. */}
        {movie.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.posterUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="aspect-[2/3]" />
      </div>

      {/*
        Below `sm` the rating and action drop under the text rather than
        squeezing it — a three-column row has no room left on a phone.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[17px] font-medium text-mx-fg">
              {movie.title}
            </h3>
            <StatusTag state={movie.userState} />
          </div>

          <p className="mt-1 text-[13px] text-mx-fg-faint">
            {DISCOVER_COPY.movieMetaLong(movie.releaseYear, genreLabel)}
          </p>

          {movie.overview && (
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-mx-fg-subtle">
              {movie.overview}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          <span
            className="text-[16px] font-semibold text-mx-fg tabular-nums"
            aria-label={DISCOVER_COPY.ratingLabel(movie.rating)}
          >
            {DISCOVER_COPY.rating(movie.rating)}
          </span>

          <button
            type="button"
            onClick={() => onAction?.(movie)}
            aria-label={action.ariaLabel(movie.title)}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-[10px] border-[0.5px] text-[14px] font-medium outline-none transition-colors focus-visible:border-mx-accent",
              actionWidth,
              action.className,
            )}
          >
            {action.label}
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Loading placeholder — same geometry and same tone sequence as the real row,
 * so the list does not reflow when the data arrives.
 */
export function MovieRowSkeleton({ toneIndex = 0 }: { toneIndex?: number }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-5 sm:gap-5 sm:px-6"
      aria-hidden="true"
    >
      <span className="hidden w-7 shrink-0 sm:block" />

      <div className={cn(posterBase, "animate-pulse", posterTone(toneIndex))}>
        <div className="aspect-[2/3]" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          <div className="h-[17px] w-1/3 animate-pulse rounded-[4px] bg-mx-chip" />
          <div className="mt-2 h-[13px] w-1/4 animate-pulse rounded-[4px] bg-mx-chip" />
          <div className="mt-3 h-[14px] w-3/4 animate-pulse rounded-[4px] bg-mx-chip" />
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          <div className="h-[16px] w-7 animate-pulse rounded-[4px] bg-mx-chip" />
          <div
            className={cn(
              "h-10 animate-pulse rounded-[10px] bg-mx-chip",
              actionWidth,
            )}
          />
        </div>
      </div>
    </div>
  );
}

export default MovieRow;
