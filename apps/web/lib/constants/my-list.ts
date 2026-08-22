import type { UserMovieStatus } from '@moviex/shared-types';

/**
 * Structure for `/my-list` — **no copy**. Every label is a key under `myList`
 * in the message files; see `lib/constants/discover.ts` for the same split.
 */

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
 * request, so there is nothing to ask the server for. Labels are
 * `myList.sort.<id>`.
 */
export const LIST_SORT_OPTIONS = [
  'recent',
  'title',
  'year',
  'rating',
] as const satisfies ReadonlyArray<ListSortId>;

export const DEFAULT_LIST_SORT: ListSortId = 'recent';

export const LIST_SORT_SEARCH_PARAM = 'sort';

export function parseListSort(value: string | undefined): ListSortId {
  return LIST_SORT_OPTIONS.find((option) => option === value) ?? DEFAULT_LIST_SORT;
}
