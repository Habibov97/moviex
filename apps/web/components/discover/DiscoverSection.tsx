"use client";

import { useState } from "react";

import { DiscoverHero } from "@/components/discover/DiscoverHero";
import { MovieGrid } from "@/components/discover/MovieGrid";
import { MovieList } from "@/components/discover/MovieList";
import { DEFAULT_VIEW_MODE, type ViewModeId } from "@/lib/constants/discover";

/**
 * Client boundary for the discover screen. `DiscoverHero` owns the toggle's own
 * state; this only mirrors it so the results below can react — the hero stays
 * the single place the mode is changed.
 *
 * It exists because `app/page.tsx` is a server component: the hero and the
 * results need to share state, and callbacks cannot cross that boundary.
 */
export function DiscoverSection() {
  const [viewMode, setViewMode] = useState<ViewModeId>(DEFAULT_VIEW_MODE);

  return (
    <>
      <DiscoverHero onViewModeChange={setViewMode} />
      {/*
        Both views take the same props and fall back to the placeholder
        catalogue; the data layer swaps in at one call site for both.
      */}
      {viewMode === "list" ? <MovieList /> : <MovieGrid />}
    </>
  );
}

export default DiscoverSection;
