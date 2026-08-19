import { Suspense } from 'react';

import { DiscoverSection } from '@/components/discover/DiscoverSection';
import { Pagination } from '@/components/discover/Pagination';
import { getDiscoverMovies, getGenres } from '@/lib/api';
import {
  GENRE_SEARCH_PARAM,
  PAGE_SEARCH_PARAM,
  parseGenreParam,
  parsePageParam,
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

  /*
   * Two different caching stories on purpose (see lib/api.ts): genres are
   * cached for 24h and degrade to an empty list, while discover results are
   * uncached per filter combination and throw on failure.
   *
   * Fetched in parallel — the genre list does not gate the results.
   */
  const [genres, discover] = await Promise.all([
    getGenres(),
    getDiscoverMovies({ genreId: selectedGenreId, page }),
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
