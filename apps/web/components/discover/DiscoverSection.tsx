"use client";

import { useState } from "react";
import type { Genre, MovieSummary } from "@moviex/shared-types";

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
  /** Parsed from the `genre` search param by the page. `null` is "Tümü". */
  selectedGenreId: number | null;
  /** The current page of `GET /tmdb/discover` results. */
  movies: MovieSummary[];
  /** TMDB's total match count for the active filter, shown in the hero. */
  resultCount: number;
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
}: DiscoverSectionProps) {
  const [viewMode, setViewMode] = useState<ViewModeId>(DEFAULT_VIEW_MODE);

  return (
    <>
      <DiscoverHero
        genres={genres}
        selectedGenreId={selectedGenreId}
        resultCount={resultCount}
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
          <MovieList movies={movies} genres={genres} />
        ) : (
          <MovieGrid movies={movies} genres={genres} />
        )}
      </div>
    </>
  );
}

export default DiscoverSection;
