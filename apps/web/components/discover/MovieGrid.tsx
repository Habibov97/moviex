"use client";

import type { Movie, MovieCategory } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { MovieCard, MovieCardSkeleton } from "@/components/discover/MovieCard";
import {
  DISCOVER_COPY,
  MOVIE_CATEGORIES,
  PLACEHOLDER_MOVIES,
  SKELETON_CARD_COUNT,
} from "@/lib/constants/discover";

export type MovieGridProps = {
  /**
   * Defaults to the placeholder catalogue. Pass the `GET /movies` page here once
   * it exists — no other change is needed.
   */
  movies?: Movie[];
  /** Used to turn each movie's `categoryId` into the label under its title. */
  categories?: MovieCategory[];
  isLoading?: boolean;
  /** Hides the "load more" button once the last page has been fetched. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  onAddMovie?: (movie: Movie) => void;
  className?: string;
};

export function MovieGrid({
  movies = PLACEHOLDER_MOVIES,
  categories = MOVIE_CATEGORIES,
  isLoading = false,
  hasMore = true,
  onLoadMore,
  onAddMovie,
  className,
}: MovieGridProps) {
  const genreLabels = new Map(
    categories.map((category) => [category.id, category.label]),
  );

  return (
    <section
      aria-label={DISCOVER_COPY.gridLabel}
      aria-busy={isLoading || undefined}
      className={cn(
        "w-full border-b-[0.5px] border-mx-border-subtle bg-mx-bg px-4 py-6 font-mx sm:px-6",
        className,
      )}
    >
      {isLoading ? (
        <div className={GRID_CLASSNAME}>
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <MovieCardSkeleton key={index} toneIndex={index} />
          ))}
          <span className="sr-only">{DISCOVER_COPY.loading}</span>
        </div>
      ) : movies.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-mx-fg-subtle">
          {DISCOVER_COPY.empty}
        </p>
      ) : (
        <ul className={GRID_CLASSNAME}>
          {movies.map((movie, index) => (
            <li key={movie.id}>
              <MovieCard
                movie={movie}
                genreLabel={genreLabels.get(movie.categoryId)}
                toneIndex={index}
                onAdd={onAddMovie}
              />
            </li>
          ))}
        </ul>
      )}

      {hasMore && !isLoading && movies.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            // TODO: fetch the next page
            onClick={() => onLoadMore?.()}
            className="inline-flex h-10 items-center rounded-[10px] border-[0.5px] border-mx-border bg-mx-chip-alt px-6 text-[14px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent"
          >
            {DISCOVER_COPY.loadMore}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The reference is an 8-up row on an ultrawide viewport; the column count steps
 * down so a card never falls below ~150px, where the title would start to clip.
 */
const GRID_CLASSNAME =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8";

export default MovieGrid;
