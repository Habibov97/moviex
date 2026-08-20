import { type MovieSortId } from '@moviex/shared-types';

/**
 * Every label, option and default the Discover screen renders.
 *
 * Copy and UI defaults only — **no catalogue data**. Genres come from
 * `GET /tmdb/genres` and films from `GET /tmdb/discover` (both in `lib/api.ts`),
 * fetched by the page and passed down as props. The only local values are the
 * "All" reset chip, which is not a TMDB genre, and the year/rating/sort
 * defaults, whose filter chips are still stubs.
 */

/** Locale used for every number the discover screens format. */
export const DISCOVER_LOCALE = 'en-US';

/**
 * The reset chip. Not a TMDB genre — it clears the filter rather than applying
 * one — so it is rendered separately from the fetched list, and `null` is what
 * "no genre selected" means throughout.
 */
export const ALL_GENRE_LABEL = 'All';

/**
 * URL search param carrying the selected TMDB genre id (`?genre=28`). Read by
 * the page, written by the chips — shared so the two cannot disagree.
 */
export const GENRE_SEARCH_PARAM = 'genre';

/**
 * Parses the `genre` search param into a TMDB id. Anything non-numeric (a
 * hand-edited URL, a stale link) falls back to `null` — "All" — rather than
 * producing a filter that matches nothing.
 */
export function parseGenreParam(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** URL search param carrying the 1-based result page (`?page=3`). */
export const PAGE_SEARCH_PARAM = 'page';

/** Release-year bounds (`?yearFrom=2015&yearTo=2026`). Written together. */
export const YEAR_FROM_SEARCH_PARAM = 'yearFrom';
export const YEAR_TO_SEARCH_PARAM = 'yearTo';

/** Minimum TMDB score, 0–10 (`?minRating=8`). */
export const MIN_RATING_SEARCH_PARAM = 'minRating';

/** Result ordering (`?sort=rating`). Holds a `MovieSortId`, not TMDB's string. */
export const SORT_SEARCH_PARAM = 'sort';

/** Search text on `/search` (`?q=blade+runner`). */
export const SEARCH_QUERY_PARAM = 'q';

/** Below this the typeahead does not fire — one letter matches everything. */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/** Keystroke pause before the typeahead requests anything, in ms. */
export const SEARCH_DEBOUNCE_MS = 350;

/** Rows the typeahead dropdown shows before "See all N results". */
export const TYPEAHEAD_RESULT_LIMIT = 4;

/** Titles offered as chips on the empty state. */
export const POPULAR_SUGGESTION_LIMIT = 4;

/**
 * The Discover screen lives at the site root, not `/discover` — `NAV_LINKS`
 * points "Discover" at `/`. Anything that wants to send the user back to
 * browsing should use this rather than hard-coding a path.
 */
export const DISCOVER_HREF = '/';

/** Where a movie card, row or typeahead result links to. */
export function movieHref(tmdbId: number): string {
  return `/movie/${tmdbId}`;
}

/** `/search?q=…`, with the query encoded. */
export function searchHref(query: string): string {
  return `/search?${SEARCH_QUERY_PARAM}=${encodeURIComponent(query)}`;
}

/**
 * TMDB's `/discover/movie` errors above page 500, so both the request and the
 * pagination UI are bounded by it. Mirrors `TMDB_MAX_PAGE` in `apps/api`.
 */
export const MAX_PAGE = 500;

/**
 * Parses the `page` search param into a request-safe page number.
 *
 * Everything out of range — `0`, negatives, `abc`, `9999` — is clamped rather
 * than forwarded, so a hand-edited URL can never make TMDB error.
 */
export function parsePageParam(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_PAGE);
}

/**
 * Anchor the pagination links target, so changing page scrolls the results
 * back into view instead of leaving the reader mid-list with nothing visibly
 * changed. A hash link keeps this server-only — no scroll effect needed.
 */
export const RESULTS_ANCHOR_ID = 'results';

/** Genres rendered before the rest collapse behind the "+N" chip. */
export const VISIBLE_GENRE_COUNT = 5;

/**
 * Full selectable span. `to` tracks the real current year rather than being
 * pinned, so the default range never silently excludes this year's releases.
 */
export const EARLIEST_YEAR = 1950;
export const CURRENT_YEAR = new Date().getFullYear();
export const RELEASE_YEAR_RANGE = {
  from: EARLIEST_YEAR,
  to: CURRENT_YEAR,
} as const;

/** Anything before this counts as a "classic" for the quick-select pill. */
export const CLASSICS_UNTIL_YEAR = 1980;

/** Selectable thresholds. `null` is "Any rating" — no filter applied. */
export const RATING_OPTIONS: ReadonlyArray<number | null> = [null, 7, 8, 9];

/**
 * Parses `yearFrom`/`yearTo` into a range inside the selectable span. Anything
 * out of range or inverted collapses back to the full default, so a
 * hand-edited URL cannot produce a query TMDB rejects or an empty grid.
 */
export function parseYearParam(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, EARLIEST_YEAR), CURRENT_YEAR);
}

/** `null` when absent or not one of the offered thresholds. */
export function parseMinRatingParam(value: string | undefined): number | null {
  const parsed = Number(value);
  return RATING_OPTIONS.includes(parsed) ? parsed : null;
}

/**
 * The orderings the sort dropdown offers.
 *
 * `id` is what goes in the URL and `sortBy` is TMDB's `sort_by` value — kept
 * apart so the address bar carries `?sort=rating` rather than leaking
 * `vote_average.desc`, and so changing TMDB's vocabulary never breaks a
 * bookmarked link. The API validates the `sortBy` half against its own
 * whitelist.
 */
export const SORT_OPTIONS: ReadonlyArray<{
  id: MovieSortId;
  label: string;
  sortBy: string;
}> = [
  { id: 'popularity', label: 'Most popular', sortBy: 'popularity.desc' },
  { id: 'rating', label: 'Highest rated', sortBy: 'vote_average.desc' },
  { id: 'newest', label: 'Newest first', sortBy: 'primary_release_date.desc' },
  { id: 'oldest', label: 'Oldest first', sortBy: 'primary_release_date.asc' },
];

/** Pre-selected, and the one ordering never written to the URL. */
export const DEFAULT_SORT_ID: MovieSortId = 'popularity';

/** Unknown or absent values fall back to the default rather than erroring. */
export function parseSortParam(value: string | undefined): MovieSortId {
  return SORT_OPTIONS.find((option) => option.id === value)?.id ?? DEFAULT_SORT_ID;
}

/** `MovieSortId` → TMDB `sort_by`. The only place the mapping lives. */
export function sortByFor(id: MovieSortId): string {
  return (
    SORT_OPTIONS.find((option) => option.id === id)?.sortBy ??
    SORT_OPTIONS[0]!.sortBy
  );
}

export function sortLabelFor(id: MovieSortId): string {
  return (
    SORT_OPTIONS.find((option) => option.id === id)?.label ??
    SORT_OPTIONS[0]!.label
  );
}

export type ViewModeId = 'grid' | 'list';

export const VIEW_MODES = [
  { id: 'grid', label: 'Grid view' },
  { id: 'list', label: 'List view' },
] as const satisfies ReadonlyArray<{ id: ViewModeId; label: string }>;

export const DEFAULT_VIEW_MODE: ViewModeId = 'grid';

/** Cards rendered while the first page is still in flight. */
export const SKELETON_CARD_COUNT = 8;

export const DISCOVER_COPY = {
  title: 'Discover',
  subtitle: 'Browse popular movies, add them to your list, mark what you have seen',
  categoriesLabel: 'Genres',
  filtersLabel: 'Filters',
  clearAll: 'Clear all',
  sortLabel: 'Sort',
  yearTitle: 'Release year',
  yearSubtitle: (from: number, to: number) =>
    `Pick a range between ${from} and ${to}`,
  yearFromLabel: 'From year',
  yearToLabel: 'To year',
  yearSeparator: 'to',
  presetThisYear: 'This year',
  presetLast5: 'Last 5 years',
  presetLast10: 'Last 10 years',
  presetClassics: 'Classics',
  ratingChip: 'Rating',
  ratingChipValue: (value: number) => `${value}+`,
  ratingTitle: 'Minimum rating',
  ratingSubtitle: 'Show movies rated at least this high',
  anyRating: 'Any rating',
  reset: 'Reset',
  apply: 'Apply',
  viewLabel: 'View',
  results: (formattedCount: string) => `${formattedCount} results`,
  showMore: (hiddenCount: number) => `+${hiddenCount}`,
  showMoreLabel: (hiddenCount: number) => `Show ${hiddenCount} more genres`,
  showLess: 'Show less',
  yearRange: (from: number, to: number) => `${from} – ${to}`,

  gridLabel: 'Movies',
  listLabel: 'Movie list',
  add: 'Add',
  addLabel: (title: string) => `Add ${title} to your list`,
  /** Offered on a film already in the list but not yet watched. */
  markWatched: 'Watched',
  markWatchedLabel: (title: string) => `Mark ${title} as watched`,
  watched: 'Watched',
  listed: 'In list',
  /** Two digits, so the numbers stay in one column down the list. */
  rank: (position: number) => String(position).padStart(2, '0'),
  loading: 'Loading movies',
  paginationLabel: 'Pagination',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  goToPage: (page: number) => `Go to page ${page}`,
  pageSummary: (page: number, totalPages: number, results: string) =>
    `Page ${page} of ${totalPages} — ${results} results`,
  empty: 'No movies found for this filter',

  // Search
  searchPlaceholder: 'Search movies…',
  searchLabel: 'Search movies',
  escHint: 'esc',
  typeaheadSection: 'Movies',
  typeaheadNoResults: 'No results',
  typeaheadSearching: 'Searching…',
  seeAllResults: (count: string) => `See all ${count} results`,
  hintNavigate: 'navigate',
  hintOpen: 'open',
  searchResultsFor: 'Search results for',
  clearSearch: 'Clear search',
  moviesFound: (count: string) => `${count} movies found`,
  sortedByRelevance: 'Sorted by relevance',
  emptyTitle: 'No movies found',
  emptyBody:
    'Nothing matched that search. Try checking the spelling, using fewer words, or searching the original title.',
  browsePopular: 'Browse popular',
  popularRightNow: 'Popular right now',
  /**
   * Always a dot decimal, matching the reference badges ("8.4").
   *
   * `null` in, `null` out — TMDB has unrated titles, so callers must branch on
   * the result rather than assume a string. Returning a placeholder here
   * instead would force every layout to render one, and a "—" reads badly
   * inside the card's star badge.
   */
  rating: (value: number | null) => (value === null ? null : value.toFixed(1)),
  /** Shown as a dash in the list column; screen readers get the full phrase. */
  notRated: '—',
  ratingLabel: (value: number | null) =>
    value === null ? 'Not yet rated' : `Rated ${value.toFixed(1)} out of 10`,
  /**
   * `releaseYear` is nullable (TMDB has undated entries), so parts are filtered
   * rather than interpolated — otherwise a missing year renders as "null · …".
   */
  movieMeta: (year: string | null, genreLabel?: string) =>
    [year, genreLabel].filter(Boolean).join(' · '),
  /**
   * `166 → "2h 46m"`. The minutes part is kept even at zero (`180 → "3h 0m"`).
   *
   * Currently unused: TMDB's `/discover/movie` does not return runtime (that
   * needs a per-movie details call), so the list row's meta line omits it. Kept
   * for when the details endpoint lands.
   */
  runtime: (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
  },
  /** Same line as `movieMeta`, plus runtime once the catalogue serves it. */
  movieMetaLong: (
    year: string | null,
    genreLabel?: string,
    runtime?: string,
  ) => [year, genreLabel, runtime].filter(Boolean).join(' · '),
} as const;

/** Cast members shown before "View all" expands to the full list. */
export const VISIBLE_CAST_COUNT = 5;

/** Copy and formatters for the movie detail page. */
export const DETAIL_COPY = {
  back: 'Back',
  watchTrailer: 'Watch trailer',
  closeTrailer: 'Close trailer',
  addToList: 'Add to list',
  inYourList: 'In your list',
  removeFromList: 'Remove from your list',
  markWatched: 'Mark as watched',
  watched: 'Watched',
  moveBackToList: 'Move back to list',
  share: 'Copy link to this movie',
  shareCopied: 'Link copied',
  overview: 'Overview',
  noOverview: 'No overview available',
  topCast: 'Top cast',
  viewAll: 'View all',
  viewFewer: 'View fewer',
  details: 'Details',
  director: 'Director',
  releaseDate: 'Release date',
  runtime: 'Runtime',
  originalLanguage: 'Original language',
  status: 'Status',
  originalTitle: 'Original title',
  /** The scale shown after the score, e.g. `8.1` `/10`. */
  ratingScale: '/10',
  watchedOn: (date: string) => date,
  /** `166` → `2h 46m`, matching the reference's meta row. */
  runtimeShort: (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
  },
  /** `166` → `166 minutes`, for the details grid. */
  runtimeLong: (minutes: number) => `${minutes} minutes`,
} as const;

/**
 * `2024-02-27` → `February 27, 2024`. Returns `null` for a missing or
 * unparseable date so the details grid can skip the row entirely.
 */
export function formatReleaseDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(DISCOVER_LOCALE, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

/**
 * `en` → `English`. Uses `Intl.DisplayNames` rather than a hand-maintained
 * map — TMDB can return any ISO 639-1 code, and a partial map would render
 * raw codes for the long tail.
 */
export function formatLanguage(code: string | null): string | null {
  if (!code) return null;
  try {
    return (
      new Intl.DisplayNames([DISCOVER_LOCALE], { type: 'language' }).of(code) ??
      code
    );
  } catch {
    return code;
  }
}
