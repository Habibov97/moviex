import { Suspense } from 'react';

import { DiscoverSection } from '@/components/discover/DiscoverSection';
import { Pagination } from '@/components/discover/Pagination';
import { getDiscoverMovies, getGenres } from '@/lib/api';
import {
  CURRENT_YEAR,
  EARLIEST_YEAR,
  GENRE_SEARCH_PARAM,
  MIN_RATING_SEARCH_PARAM,
  PAGE_SEARCH_PARAM,
  SORT_SEARCH_PARAM,
  YEAR_FROM_SEARCH_PARAM,
  YEAR_TO_SEARCH_PARAM,
  parseGenreParam,
  parseMinRatingParam,
  parsePageParam,
  parseSortParam,
  parseYearParam,
  sortByFor,
} from '@/lib/constants/discover';

type HomeProps = {
  /** Next 15+ hands search params to the page as a promise. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Search params arrive as `string | string[]`; every filter here is single. */
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  const selectedGenreId = parseGenreParam(first(params[GENRE_SEARCH_PARAM]));
  // Clamped, never forwarded raw — an out-of-range page would make TMDB error.
  const page = parsePageParam(first(params[PAGE_SEARCH_PARAM]));

  // Absent params fall back to the full span, i.e. no year filter at all.
  const yearFrom = parseYearParam(
    first(params[YEAR_FROM_SEARCH_PARAM]),
    EARLIEST_YEAR,
  );
  const yearTo = parseYearParam(
    first(params[YEAR_TO_SEARCH_PARAM]),
    CURRENT_YEAR,
  );
  const minRating = parseMinRatingParam(first(params[MIN_RATING_SEARCH_PARAM]));
  // Our own sort id in the URL; TMDB's `sort_by` string is looked up from it.
  const sort = parseSortParam(first(params[SORT_SEARCH_PARAM]));

  /*
   * The full span is "no year filter", so it is not forwarded: sending it would
   * quietly drop pre-1950 and undated releases from an unfiltered browse, and
   * TMDB's unfiltered total (~1.17M) would shrink for no reason the user asked
   * for. Matches the URL, which also omits the default range.
   */
  const isFullYearRange =
    yearFrom === EARLIEST_YEAR && yearTo === CURRENT_YEAR;

  /*
   * Two different caching stories on purpose (see lib/api.ts): genres are
   * cached for 24h and degrade to an empty list, while discover results are
   * uncached per filter combination and throw on failure.
   *
   * Fetched in parallel — the genre list does not gate the results.
   */
  const [genres, discover] = await Promise.all([
    getGenres(),
    getDiscoverMovies({
      genreId: selectedGenreId,
      page,
      yearFrom: isFullYearRange ? null : yearFrom,
      yearTo: isFullYearRange ? null : yearTo,
      minRating,
      sort: sortByFor(sort),
    }),
  ]);

  return (
    <main>
      {/*
        Suspense boundary: DiscoverHero reads the search params on the client
        via `useSearchParams`, which Next requires to be suspended.
      */}
      <Suspense>
        <DiscoverSection
          genres={genres}
          selectedGenreId={selectedGenreId}
          movies={discover.results}
          resultCount={discover.totalResults}
          yearFrom={yearFrom}
          yearTo={yearTo}
          minRating={minRating}
          sort={sort}
        />
      </Suspense>

      {/*
        Server-rendered: every page control is a plain link, so changing page is
        a normal navigation that re-runs this fetch. No client state involved.
      */}
      <Pagination
        currentPage={discover.page}
        totalPages={discover.totalPages}
        totalResults={discover.totalResults}
        searchParams={params}
      />
    </main>
  );
}
