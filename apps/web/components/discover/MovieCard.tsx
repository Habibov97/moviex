"use client";

import { useFormatter, useTranslations } from "next-intl";
import { IconPlus } from "@tabler/icons-react";
import type { MovieSummary } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { StatusTag } from "@/components/discover/StatusTag";
import {
  RATING_NUMBER_FORMAT,
  movieHref,
  movieMeta,
} from "@/lib/constants/discover";
import { posterTone } from "@/lib/poster-tone";

/** Poster geometry shared with the skeleton, so the two never drift apart. */
const posterBase =
  "relative aspect-[2/3] overflow-hidden rounded-[12px] border-[0.5px] border-mx-border-subtle";

export type MovieCardProps = {
  movie: MovieSummary;
  /**
   * Resolved from the genre list by the caller — the card never owns a genre
   * label of its own.
   */
  genreLabel?: string;
  /** Position in the grid; picks which skeleton tone the poster falls back to. */
  toneIndex?: number;
  /**
   * Adds the film to the watchlist. Only ever called for a film with no status
   * — a saved film renders a badge and no button at all.
   */
  onAdd?: (movie: MovieSummary) => void;
  className?: string;
};

export function MovieCard({
  movie,
  genreLabel,
  toneIndex = 0,
  onAdd,
  className,
}: MovieCardProps) {
  const t = useTranslations("discover");
  const format = useFormatter();

  /*
   * `null` for a title TMDB has no score for. Formatted through next-intl
   * rather than `toFixed`, so Russian gets "8,4" — the decimal separator is
   * part of the locale, not part of the number.
   */
  const formattedRating =
    movie.rating === null
      ? null
      : format.number(movie.rating, RATING_NUMBER_FORMAT);

  return (
    <article className={cn("group relative font-mx", className)}>
      <div className={cn(posterBase, posterTone(toneIndex))}>
        {/*
          Layered over the tone rather than replacing it, so a missing or
          still-loading poster simply leaves the skeleton colour visible.
          Plain <img>: next/image would need `image.tmdb.org` in
          next.config.js's remotePatterns, and these are already fixed-width
          w500 files.
        */}
        {movie.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.posterUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        )}

        {/*
          Hover scrim. It used to exist so the full-width Add bar stayed
          readable; the bar is gone, but it still reads as the card's hover
          state and gives the button's glow something to sit against, so it
          stays.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-mx-poster-scrim opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        />

        <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-2.5">
          <StatusTag state={movie.userState} />

          {/*
            Unrated titles drop the badge entirely rather than showing a dash:
            it floats over artwork with nothing to align to, so an empty-looking
            pill would read as a rendering fault.
          */}
          {formattedRating !== null && (
            <span
              className="ml-auto inline-flex h-6 shrink-0 items-center rounded-[6px] bg-mx-poster-badge px-2 text-[12px] font-medium text-mx-poster-fg tabular-nums"
              aria-label={t("ratingLabel", { value: formattedRating })}
            >
              {formattedRating}
            </span>
          )}
        </div>

        {/*
          The Add button, and **only** for a film with no status yet.

          A saved film shows its badge above and nothing else: the card no
          longer cycles watchlist → watched on repeated clicks. Changing a
          status is My List's job, which has the full set of actions; a card
          offers the one step that makes sense from a catalogue — put this on
          the list — and then reports state.

          Bottom-right rather than a full-width bar along the bottom: the badges
          own the top of the poster, and a 34px circle leaves the artwork
          visible. Sits above the card-wide link (z-10) and stops its own click
          there, so adding never also navigates to the detail page.

          Always visible — no hover gate. The old bar faded in on
          `group-hover`, which meant a second rule to un-hide it on touch; a
          mark this small does not need to hide, so hover only scales it.
        */}
        {!movie.userState && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAdd?.(movie);
            }}
            aria-label={t("addLabel", { title: movie.title })}
            className={cn(
              "absolute right-[9px] bottom-[9px] z-10 flex size-[34px] items-center justify-center rounded-full",
              "border border-mx-add-fab-border bg-mx-add-fab backdrop-blur-[8px]",
              "shadow-[0_4px_14px_var(--mx-add-fab-glow)] text-mx-on-accent outline-none",
              // Scale only, so the glass and the glow are untouched by hover.
              "transition-transform duration-200 hover:scale-[1.08] focus-visible:scale-[1.08]",
            )}
          >
            <IconPlus className="size-[18px]" stroke={2.25} aria-hidden="true" />
          </button>
        )}
      </div>

      {/*
        A single stretched link over the whole card keeps one tab stop and one
        accessible name, rather than making the poster and title separate links.
      */}
      <Link
        href={movieHref(movie.tmdbId)}
        className="absolute inset-0 z-0 outline-none focus-visible:ring-1 focus-visible:ring-mx-accent"
      >
        <span className="sr-only">{movie.title}</span>
      </Link>

      <h3 className="mt-2.5 truncate text-[15px] font-medium text-mx-fg">
        {movie.title}
      </h3>
      <p className="mt-0.5 truncate text-[13px] text-mx-fg-faint">
        {movieMeta(movie.releaseYear, genreLabel)}
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
