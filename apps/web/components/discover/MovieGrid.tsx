"use client";

import { useTranslations } from "next-intl";
import type { Genre, MovieSummary } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { MovieCard, MovieCardSkeleton } from "@/components/discover/MovieCard";
import { SKELETON_CARD_COUNT } from "@/lib/constants/discover";

export type MovieGridProps = {
  /** A page of results from `GET /tmdb/discover`, fetched by the page. */
  movies: MovieSummary[];
  /**
   * Live TMDB genres, used to turn each movie's `genreId` into the label under
   * its title. Empty simply means no genre label is rendered.
   */
  genres?: Genre[];
  isLoading?: boolean;
  onAddMovie?: (movie: MovieSummary) => void;
  className?: string;
};

export function MovieGrid({
  movies,
  genres = [],
  isLoading = false,
  onAddMovie,
  className,
}: MovieGridProps) {
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
      aria-label={t("gridLabel")}
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
          <span className="sr-only">{t("loading")}</span>
        </div>
      ) : movies.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-mx-fg-subtle">
          {t("empty")}
        </p>
      ) : (
        <ul className={GRID_CLASSNAME}>
          {movies.map((movie, index) => (
            <li key={movie.tmdbId}>
              <MovieCard
                movie={movie}
                genreLabel={genreLabelFor(movie)}
                toneIndex={index}
                onAdd={onAddMovie}
              />
            </li>
          ))}
        </ul>
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
