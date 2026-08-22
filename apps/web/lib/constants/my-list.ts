import type { UserMovieStatus } from '@moviex/shared-types';

/** The tab a user is on, mirrored in the URL. Same convention as Discover. */
export const STATUS_SEARCH_PARAM = 'status';

export const DEFAULT_LIST_TAB: UserMovieStatus = 'watchlist';

/** Anything unrecognised falls back to the default tab. */
export function parseListTab(value: string | undefined): UserMovieStatus {
  return value === 'watched' ? 'watched' : DEFAULT_LIST_TAB;
}

export type ListSortId = 'recent' | 'title' | 'year' | 'rating';

/**
 * My List sorts client-side — the whole list is already in memory from one
 * request, so there is nothing to ask the server for.
 */
export const LIST_SORT_OPTIONS: ReadonlyArray<{
  id: ListSortId;
  label: string;
}> = [
  { id: 'recent', label: 'Recently added' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'year', label: 'Release year' },
  { id: 'rating', label: 'Rating' },
];

export const DEFAULT_LIST_SORT: ListSortId = 'recent';

export const LIST_SORT_SEARCH_PARAM = 'sort';

export function parseListSort(value: string | undefined): ListSortId {
  return (
    LIST_SORT_OPTIONS.find((option) => option.id === value)?.id ??
    DEFAULT_LIST_SORT
  );
}

export const MY_LIST_COPY = {
  title: 'My list',
  subtitle: "Everything you've saved and seen",

  statWatchlist: 'Watchlist',
  statWatched: 'Watched',
  statTopGenre: 'Top genre',
  statUnit: 'movies',
  /** Shown when nothing saved yet carries a genre. */
  noGenre: '—',

  tabWatchlist: 'Watchlist',
  tabWatched: 'Watched',

  addedOn: (date: string) => `Added ${date}`,
  watchedOn: (date: string) => `Watched ${date}`,

  markWatched: 'Watched',
  remove: 'Remove',
  moreActions: 'More actions',

  emptyWatchlistTitle: 'Your watchlist is empty',
  emptyWatchlistBody:
    'Movies you save will show up here. Start exploring to find something to watch.',
  emptyWatchedTitle: "You haven't marked anything watched yet",
  emptyWatchedBody:
    'Once you mark a movie as watched it will show up here, with the date you saw it.',
  browseMovies: 'Browse movies',
} as const;

/** `2026-08-21T…` → `Aug 21`, matching the reference's short captions. */
export function formatListDate(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}
