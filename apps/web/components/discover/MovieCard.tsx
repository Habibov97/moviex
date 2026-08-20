"use client";

import Link from "next/link";
import type { MovieSummary } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { StatusTag } from "@/components/discover/StatusTag";
import { DISCOVER_COPY, movieHref } from "@/lib/constants/discover";
import { posterTone } from "@/lib/poster-tone";

/** Poster geometry shared with the skeleton, so the two never drift apart. */
const posterBase =
  "relative aspect-[2/3] overflow-hidden rounded-[12px] border-[0.5px] border-mx-border-subtle";

export type MovieCardProps = {
  movie: MovieSummary;
  /**
   * Resolved from the category list by the caller — the card never owns a genre
   * label of its own.
   */
  genreLabel?: string;
  /** Position in the grid; picks which skeleton tone the poster falls back to. */
  toneIndex?: number;
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
  // `null` for a title TMDB has no score for — see DISCOVER_COPY.rating.
  const formattedRating = DISCOVER_COPY.rating(movie.rating);

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

        {/* Hover scrim: dims the poster so the action below stays readable. */}
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
              aria-label={DISCOVER_COPY.ratingLabel(movie.rating)}
            >
              {formattedRating}
            </span>
          )}
        </div>

        {/*
          Revealed on hover, on keyboard focus, and permanently on devices with
          no hover at all — otherwise the action would be invisible on touch.
        */}
        {/*
          Sits above the card-wide link (z-10) and stops the click there, so
          adding to a list never also navigates to the detail page.
        */}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAdd?.(movie);
          }}
          aria-label={DISCOVER_COPY.addLabel(movie.title)}
          className="absolute inset-x-2.5 bottom-2.5 z-10 flex h-8 items-center justify-center rounded-[8px] bg-mx-accent text-[13px] font-medium text-mx-on-accent opacity-0 outline-none transition-[opacity,background-color] duration-200 group-hover:opacity-100 hover:bg-mx-accent-hover focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          {DISCOVER_COPY.add}
        </button>
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
        {DISCOVER_COPY.movieMeta(movie.releaseYear, genreLabel)}
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
