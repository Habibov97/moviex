"use client";

import { useState } from "react";
import type { Genre, MovieSortId, MovieSummary } from "@moviex/shared-types";

import { useLibraryActions } from "@/hooks/use-library-actions";
import { useMovieStatuses } from "@/hooks/use-user-movies";
import { DiscoverHero } from "@/components/discover/DiscoverHero";
import { MovieGrid } from "@/components/discover/MovieGrid";
import { MovieList } from "@/components/discover/MovieList";
import {
  DEFAULT_VIEW_MODE,
  RESULTS_ANCHOR_ID,
  type ViewModeId,
} from "@/lib/constants/discover";

export type DiscoverSectionProps = {
  /** Fetched server-side from `GET /tmdb/genres` and passed straight through. */
  genres: Genre[];
  /** Parsed from the `genre` search param by the page. `null` is "All". */
  selectedGenreId: number | null;
  /** The current page of `GET /tmdb/discover` results. */
  movies: MovieSummary[];
  /** TMDB's total match count for the active filter, shown in the hero. */
  resultCount: number;
  /** Applied release-year range, parsed from the URL by the page. */
  yearFrom: number;
  yearTo: number;
  /** Applied minimum score, or `null` for "Any rating". */
  minRating: number | null;
  /** Active result ordering, parsed from the URL by the page. */
  sort: MovieSortId;
};

/**
 * Client boundary for the discover screen. `DiscoverHero` owns the view
 * toggle's own state; this only mirrors it so the results below can react — the
 * hero stays the single place the mode is changed.
 *
 * It exists because `app/page.tsx` is a server component: the hero and the
 * results need to share the view mode, and callbacks cannot cross that
 * boundary. Nothing here fetches — genres, movies and the selected genre all
 * arrive as props, and the selection itself lives in the URL.
 */
export function DiscoverSection({
  genres,
  selectedGenreId,
  movies,
  resultCount,
  yearFrom,
  yearTo,
  minRating,
  sort,
}: DiscoverSectionProps) {
  const [viewMode, setViewMode] = useState<ViewModeId>(DEFAULT_VIEW_MODE);

  // Same gate the detail page uses: signed out opens the auth modal, signed in
  // hits the placeholder handler. TODO lives in the hook, not here.
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
      <DiscoverHero
        genres={genres}
        selectedGenreId={selectedGenreId}
        resultCount={resultCount}
        yearFrom={yearFrom}
        yearTo={yearTo}
        minRating={minRating}
        sort={sort}
        onViewModeChange={setViewMode}
      />
      {/*
        Both views take the same props; the genre list is what turns each
        movie's `genreIds` into a readable label.

        The anchor is what the pagination links target. `scroll-mt-16` clears
        the sticky 64px navbar, which would otherwise cover the first row.
      */}
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

export default DiscoverSection;
