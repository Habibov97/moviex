"use client";

import type { Movie, MovieCategory } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { MovieRow, MovieRowSkeleton } from "@/components/discover/MovieRow";
import { LoadMoreButton } from "@/components/discover/LoadMoreButton";
import {
  DISCOVER_COPY,
  MOVIE_CATEGORIES,
  PLACEHOLDER_MOVIES,
  SKELETON_CARD_COUNT,
} from "@/lib/constants/discover";

/**
 * List view of the discover results — the same data and the same props as
 * `MovieGrid`, laid out as ranked rows. Deliberately prop-compatible with it so
 * the view toggle can swap one for the other without the page reshaping data.
 */
export type MovieListProps = {
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
  /**
   * Fired by whichever action the row's state offers — add, rate, or mark
   * watched. The row passes the movie back so the caller can branch on
   * `movie.userState` rather than the list needing three separate handlers.
   */
  onMovieAction?: (movie: Movie) => void;
  className?: string;
};

export function MovieList({
  movies = PLACEHOLDER_MOVIES,
  categories = MOVIE_CATEGORIES,
  isLoading = false,
  hasMore = true,
  onLoadMore,
  onMovieAction,
  className,
}: MovieListProps) {
  const genreLabels = new Map(
    categories.map((category) => [category.id, category.label]),
  );

  return (
    <section
      aria-label={DISCOVER_COPY.listLabel}
      aria-busy={isLoading || undefined}
      className={cn(
        "w-full border-b-[0.5px] border-mx-border-subtle bg-mx-bg px-4 py-6 font-mx sm:px-6",
        className,
      )}
    >
      {isLoading ? (
        <div className={SHELL_CLASSNAME}>
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <MovieRowSkeleton key={index} toneIndex={index} />
          ))}
          <span className="sr-only">{DISCOVER_COPY.loading}</span>
        </div>
      ) : movies.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-mx-fg-subtle">
          {DISCOVER_COPY.empty}
        </p>
      ) : (
        <ol className={SHELL_CLASSNAME}>
          {movies.map((movie, index) => (
            <li key={movie.id}>
              <MovieRow
                movie={movie}
                position={index + 1}
                genreLabel={genreLabels.get(movie.categoryId)}
                toneIndex={index}
                onAction={onMovieAction}
              />
            </li>
          ))}
        </ol>
      )}

      {hasMore && !isLoading && movies.length > 0 && (
        <LoadMoreButton onClick={onLoadMore} />
      )}
    </section>
  );
}

/**
 * One bordered card holding every row, hairline-divided — the reference draws
 * the list as a single surface rather than as separate cards per film.
 */
const SHELL_CLASSNAME =
  "divide-y-[0.5px] divide-mx-border-subtle overflow-hidden rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-card";

export default MovieList;
