"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MovieSummary } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { StatusTag } from "@/components/discover/StatusTag";
import { posterTone } from "@/lib/poster-tone";
import {
  RATING_NUMBER_FORMAT,
  movieHref,
  movieMeta,
  rankLabel,
} from "@/lib/constants/discover";

/**
 * A row has **one** action or none, and which it is depends only on whether the
 * film is saved at all.
 *
 * This replaced a `ROW_ACTIONS` map keyed by state, where a saved film swapped
 * `Add` for `Mark as watched` and a watched film went back to `Add` — clicking
 * the same button repeatedly cycled the film round that loop. A saved film now
 * renders its `StatusTag` and no button: changing a status belongs to My List,
 * which has the full set of actions and the confirmation that goes with them.
 * There is no rating action in this flow either.
 */
const ADD_BUTTON_CLASSNAME =
  "border-transparent bg-mx-accent text-mx-on-accent hover:bg-mx-accent-hover";

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
   * Resolved from the genre list by the caller — the row never owns a genre
   * label of its own.
   */
  genreLabel?: string;
  /** Position in the list; picks which skeleton tone the poster falls back to. */
  toneIndex?: number;
  /**
   * Adds the film to the watchlist. Only ever called for a film with no status
   * — a saved row renders its badge and no button at all.
   */
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
  const t = useTranslations("discover");
  const format = useFormatter();

  // `null` for a title TMDB has no score for — see MovieCard.
  const formattedRating =
    movie.rating === null
      ? null
      : format.number(movie.rating, RATING_NUMBER_FORMAT);
  // No runtime: TMDB's discover endpoint doesn't return it, so the meta line
  // is just "year · genre" until a details call fills it in.

  return (
    <article
      className={cn(
        "relative flex items-center gap-3 px-4 py-5 transition-colors hover:bg-mx-chip sm:gap-5 sm:px-6",
        className,
      )}
    >
      {/*
        Stretched over the row, beneath the action button — one tab stop, and
        the button below stops its own click from reaching it.
      */}
      <Link
        href={movieHref(movie.tmdbId)}
        className="absolute inset-0 z-0 outline-none focus-visible:ring-1 focus-visible:ring-mx-accent"
      >
        <span className="sr-only">{movie.title}</span>
      </Link>

      {/* Decorative: the rank restates list order, which the markup already carries. */}
      <span
        aria-hidden="true"
        className="hidden w-7 shrink-0 text-[13px] text-mx-fg-faint tabular-nums sm:block"
      >
        {rankLabel(position)}
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
            {movieMeta(movie.releaseYear, genreLabel)}
          </p>

          {movie.overview && (
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-mx-fg-subtle">
              {movie.overview}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          {/*
            Unlike the card, this keeps its slot when unrated — it is a column
            in a row, and dropping it would shunt the action button left and
            break alignment down the list. A muted dash holds the position.
          */}
          <span
            className={cn(
              "text-[16px] font-semibold tabular-nums",
              formattedRating === null ? "text-mx-fg-faint" : "text-mx-fg",
            )}
            aria-label={
              formattedRating === null
                ? t("notRatedLabel")
                : t("ratingLabel", { value: formattedRating })
            }
          >
            {formattedRating ?? t("notRated")}
          </span>

          {movie.userState ? (
            /*
              An inert spacer, not nothing. The rating sits in the same
              right-hand group as the button, so dropping the button entirely
              would pull the rating rightwards on saved rows only and break the
              column down the list. Rendered from `sm` up, where the group is a
              row; below that the button is full-width and stacked, so a blank
              slot would just be a gap.
            */
            <span
              aria-hidden="true"
              className="hidden h-10 shrink-0 sm:block sm:w-[124px]"
            />
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAction?.(movie);
              }}
              aria-label={t("addLabel", { title: movie.title })}
              className={cn(
                "relative z-10 inline-flex h-10 items-center justify-center rounded-[10px] border-[0.5px] text-[14px] font-medium outline-none transition-colors focus-visible:border-mx-accent",
                actionWidth,
                ADD_BUTTON_CLASSNAME,
              )}
            >
              {t("add")}
            </button>
          )}
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
