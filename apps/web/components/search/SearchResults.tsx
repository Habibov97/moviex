"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconSparkles } from "@tabler/icons-react";
import type { Genre, MovieSummary } from "@moviex/shared-types";

import { useLibraryActions } from "@/hooks/use-library-actions";
import { useMovieStatuses } from "@/hooks/use-user-movies";
import { MovieGrid } from "@/components/discover/MovieGrid";
import { MovieList } from "@/components/discover/MovieList";
import { ViewToggle } from "@/components/discover/ViewToggle";
import {
  DEFAULT_VIEW_MODE,
  RESULTS_ANCHOR_ID,
  type ViewModeId,
} from "@/lib/constants/discover";

export type SearchResultsProps = {
  movies: MovieSummary[];
  genres: Genre[];
  totalResults: number;
};

/**
 * The meta row and result grid for `/search`.
 *
 * Client-side only because the view toggle holds its selection in state, the
 * same way Discover does. The cards themselves are Discover's `MovieGrid` /
 * `MovieList` untouched — search and discover render the same `MovieSummary`,
 * so there is no second set of card components.
 */
export function SearchResults({
  movies,
  genres,
  totalResults,
}: SearchResultsProps) {
  const t = useTranslations("search");
  const [viewMode, setViewMode] = useState<ViewModeId>(DEFAULT_VIEW_MODE);

  // Identical gate to Discover and the detail page — same hook, same TODO.
  const { runCardAction, authModal } = useLibraryActions({ genres });

  /*
   * One batch lookup for every movie on screen, not one per card. Mutations
   * invalidate the `['user-movies']` root key, so a change made on a detail
   * page shows up here without a manual refresh.
   */
  const { statuses } = useMovieStatuses(movies.map((movie) => movie.tmdbId));

  // The saved status is the card's badge; TMDB never supplies `userState`.
  const withStatus = movies.map((movie) => ({
    ...movie,
    userState: statuses.get(movie.tmdbId) ?? null,
  }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b-[0.5px] border-mx-border-subtle px-4 pb-4 font-mx sm:px-6">
        <p className="text-[13.5px] text-mx-fg-muted">
          {t("moviesFound", { count: totalResults })}
        </p>
        <span aria-hidden="true" className="text-mx-fg-faint">
          ·
        </span>
        {/*
          Says why there is no filter bar here: TMDB's search endpoint ranks by
          relevance and accepts no genre/rating/sort parameters.
        */}
        <p className="flex items-center gap-1.5 text-[13.5px] text-mx-fg-faint">
          <IconSparkles className="size-3.5" stroke={1.75} aria-hidden="true" />
          {t("sortedByRelevance")}
        </p>

        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          className="ml-auto"
        />
      </div>

      <div id={RESULTS_ANCHOR_ID} className="scroll-mt-16">
        {viewMode === "list" ? (
          <MovieList
            movies={withStatus}
            genres={genres}
            onMovieAction={runCardAction}
          />
        ) : (
          <MovieGrid
            movies={withStatus}
            genres={genres}
            onAddMovie={runCardAction}
          />
        )}
      </div>

      {authModal}
    </>
  );
}

export default SearchResults;
