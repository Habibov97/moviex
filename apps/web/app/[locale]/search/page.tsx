import { redirect } from 'next/navigation';
import Link from 'next/link';
import { IconX } from '@tabler/icons-react';

import { Pagination } from '@/components/discover/Pagination';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchEmptyState } from '@/components/search/SearchEmptyState';
import { getDiscoverMovies, getGenres, getSearchResults } from '@/lib/api';
import {
  DISCOVER_COPY,
  DISCOVER_HREF,
  PAGE_SEARCH_PARAM,
  POPULAR_SUGGESTION_LIMIT,
  SEARCH_QUERY_PARAM,
  parsePageParam,
} from '@/lib/constants/discover';

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  const query = first(params[SEARCH_QUERY_PARAM])?.trim() ?? '';

  // Nothing meaningful to render without a query, and the API would 400.
  if (!query) redirect(DISCOVER_HREF);

  const page = parsePageParam(first(params[PAGE_SEARCH_PARAM]));

  /*
   * Genre/rating/sort are deliberately not read here even when they linger in
   * the URL from a Discover visit: TMDB's search endpoint cannot apply them.
   * The meta row says "Sorted by relevance" for exactly this reason.
   */
  const [genres, results] = await Promise.all([
    getGenres(),
    getSearchResults({ query, page }),
  ]);

  const isEmpty = results.results.length === 0;

  // Only fetched when there is a dead end to rescue.
  const suggestions = isEmpty
    ? (await getDiscoverMovies({ sort: 'popularity.desc' })).results.slice(
        0,
        POPULAR_SUGGESTION_LIMIT,
      )
    : [];

  return (
    <main className="font-mx">
      <div className="flex flex-wrap items-start gap-4 px-4 pt-6 pb-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-mx-fg-subtle">
            {DISCOVER_COPY.searchResultsFor}
          </p>
          <h1 className="mt-1 truncate text-[21px] font-medium text-mx-fg">
            {query}
          </h1>
        </div>

        {/* Clearing the search means leaving it — back to browsing. */}
        <Link
          href={DISCOVER_HREF}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] border-[0.5px] border-mx-border px-4 text-[13.5px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent"
        >
          <IconX className="size-4" stroke={1.75} aria-hidden="true" />
          {DISCOVER_COPY.clearSearch}
        </Link>
      </div>

      {isEmpty ? (
        <>
          <div className="border-b-[0.5px] border-mx-border-subtle" />
          <SearchEmptyState suggestions={suggestions} />
        </>
      ) : (
        <>
          <SearchResults
            movies={results.results}
            genres={genres}
            totalResults={results.totalResults}
          />

          {/* Discover's pagination, given search's totals. */}
          <Pagination
            currentPage={results.page}
            totalPages={results.totalPages}
            totalResults={results.totalResults}
            searchParams={params}
            pathname="/search"
          />
        </>
      )}
    </main>
  );
}
