"use client";

import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import type { Genre, MovieSummary } from "@moviex/shared-types";

import { useLibraryActions } from "@/hooks/use-library-actions";
import { MovieGrid } from "@/components/discover/MovieGrid";
import { MovieList } from "@/components/discover/MovieList";
import { ViewToggle } from "@/components/discover/ViewToggle";
import {
  DEFAULT_VIEW_MODE,
  DISCOVER_COPY,
  DISCOVER_LOCALE,
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
  const [viewMode, setViewMode] = useState<ViewModeId>(DEFAULT_VIEW_MODE);

  // Identical gate to Discover and the detail page — same hook, same TODO.
  const { runCardAction, authModal } = useLibraryActions();

  const formattedTotal = new Intl.NumberFormat(DISCOVER_LOCALE).format(
    totalResults,
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b-[0.5px] border-mx-border-subtle px-4 pb-4 font-mx sm:px-6">
        <p className="text-[13.5px] text-mx-fg-muted">
          {DISCOVER_COPY.moviesFound(formattedTotal)}
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
          {DISCOVER_COPY.sortedByRelevance}
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
            movies={movies}
            genres={genres}
            onMovieAction={runCardAction}
          />
        ) : (
          <MovieGrid
            movies={movies}
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
