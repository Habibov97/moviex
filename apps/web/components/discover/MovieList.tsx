"use client";

import { useTranslations } from "next-intl";
import type { Genre, MovieSummary } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { MovieRow, MovieRowSkeleton } from "@/components/discover/MovieRow";
import { SKELETON_CARD_COUNT } from "@/lib/constants/discover";

/**
 * List view of the discover results — the same data and the same props as
 * `MovieGrid`, laid out as ranked rows. Deliberately prop-compatible with it so
 * the view toggle can swap one for the other without the page reshaping data.
 */
export type MovieListProps = {
  /** A page of results from `GET /tmdb/discover`, fetched by the page. */
  movies: MovieSummary[];
  /**
   * Live TMDB genres, used to turn each movie's `genreId` into the label under
   * its title. Empty simply means no genre label is rendered.
   */
  genres?: Genre[];
  isLoading?: boolean;
  /**
   * Adds a film to the watchlist. A row only offers this while the film has no
   * status — once saved it shows a badge and no button, so this never fires for
   * an already-saved film and the caller has nothing to branch on.
   */
  onMovieAction?: (movie: MovieSummary) => void;
  className?: string;
};

export function MovieList({
  movies,
  genres = [],
  isLoading = false,
  onMovieAction,
  className,
}: MovieListProps) {
  const t = useTranslations("discover");
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));

  /**
   * TMDB gives every film several genre ids; the card has room for one. Take
   * the first that resolves against the fetched list, so an id we don't have a
   * name for falls through to the next rather than blanking the label.
   */
  const genreLabelFor = (movie: MovieSummary) =>
    movie.genreIds.map((id) => genreNames.get(id)).find(Boolean);

  return (
    <section
      aria-label={t("listLabel")}
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
          <span className="sr-only">{t("loading")}</span>
        </div>
      ) : movies.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-mx-fg-subtle">
          {t("empty")}
        </p>
      ) : (
        <ol className={SHELL_CLASSNAME}>
          {movies.map((movie, index) => (
            <li key={movie.tmdbId}>
              <MovieRow
                movie={movie}
                position={index + 1}
                genreLabel={genreLabelFor(movie)}
                toneIndex={index}
                onAction={onMovieAction}
              />
            </li>
          ))}
        </ol>
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
