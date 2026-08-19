import { type DiscoverFilters, type MovieSortId } from '@moviex/shared-types';

/**
 * Every label, option and default the discover ("Keşfet") screen renders.
 *
 * Copy and UI defaults only — **no catalogue data**. Genres come from
 * `GET /tmdb/genres` and films from `GET /tmdb/discover` (both in `lib/api.ts`),
 * fetched by the page and passed down as props. The only local values are the
 * "Tümü" reset chip, which is not a TMDB genre, and the year/rating/sort
 * defaults, whose filter chips are still stubs.
 */

/** Locale used for every number the discover screens format. */
export const DISCOVER_LOCALE = 'tr-TR';

/**
 * The reset chip. Not a TMDB genre — it clears the filter rather than applying
 * one — so it is rendered separately from the fetched list, and `null` is what
 * "no genre selected" means throughout.
 */
export const ALL_GENRE_LABEL = 'Tümü';

/**
 * URL search param carrying the selected TMDB genre id (`?genre=28`). Read by
 * the page, written by the chips — shared so the two cannot disagree.
 */
export const GENRE_SEARCH_PARAM = 'genre';

/**
 * Parses the `genre` search param into a TMDB id. Anything non-numeric (a
 * hand-edited URL, a stale link) falls back to `null` — "Tümü" — rather than
 * producing a filter that matches nothing.
 */
export function parseGenreParam(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** URL search param carrying the 1-based result page (`?page=3`). */
export const PAGE_SEARCH_PARAM = 'page';

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

export const RELEASE_YEAR_RANGE = { from: 2020, to: 2026 } as const;

export const MIN_RATING = 7;

export const SORT_OPTIONS: ReadonlyArray<{ id: MovieSortId; label: string }> = [
  { id: 'popularity', label: 'Popülerlik' },
  { id: 'rating', label: 'Puan' },
  { id: 'release-date', label: 'Çıkış tarihi' },
  { id: 'title', label: 'Ad' },
];

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  genreId: null,
  yearFrom: RELEASE_YEAR_RANGE.from,
  yearTo: RELEASE_YEAR_RANGE.to,
  minRating: MIN_RATING,
  sort: 'popularity',
};

export type ViewModeId = 'grid' | 'list';

export const VIEW_MODES = [
  { id: 'grid', label: 'Izgara görünümü' },
  { id: 'list', label: 'Liste görünümü' },
] as const satisfies ReadonlyArray<{ id: ViewModeId; label: string }>;

export const DEFAULT_VIEW_MODE: ViewModeId = 'grid';

/** Cards rendered while the first page is still in flight. */
export const SKELETON_CARD_COUNT = 8;

export const DISCOVER_COPY = {
  title: 'Keşfet',
  subtitle: 'Popüler filmleri gez, listene ekle, puanla',
  categoriesLabel: 'Kategoriler',
  filtersLabel: 'Filtreler',
  viewLabel: 'Görünüm',
  results: (formattedCount: string) => `${formattedCount} sonuç`,
  showMore: (hiddenCount: number) => `+${hiddenCount}`,
  showMoreLabel: (hiddenCount: number) => `${hiddenCount} kategori daha göster`,
  showLess: 'Daha az',
  yearRange: (from: number, to: number) => `${from} – ${to}`,
  minRating: (value: number) => `${value}+ puan`,

  gridLabel: 'Filmler',
  listLabel: 'Filmler listesi',
  add: 'Ekle',
  addLabel: (title: string) => `${title} filmini listene ekle`,
  /** Offered on a film already in the list but not yet watched. */
  markWatched: 'İzledim',
  markWatchedLabel: (title: string) => `${title} filmini izlendi olarak işaretle`,
  watched: 'İzlendi',
  listed: 'Listede',
  /** Two digits, so the numbers stay in one column down the list. */
  rank: (position: number) => String(position).padStart(2, '0'),
  loading: 'Filmler yükleniyor',
  /** Matches the reference image's wording. */
  paginationLabel: 'Səhifələr',
  previousPage: 'Əvvəlki səhifə',
  nextPage: 'Növbəti səhifə',
  goToPage: (page: number) => `${page}-ci səhifəyə keç`,
  pageSummary: (page: number, totalPages: number, results: string) =>
    `${page}-ci səhifə, ${totalPages}-dən — ${results} nəticə`,
  empty: 'Bu filtrelere uyan film bulunamadı',
  /**
   * Deliberately not `Intl.NumberFormat(DISCOVER_LOCALE)`: tr-TR would render
   * "8,4", and the reference badges read "8.4".
   */
  rating: (value: number) => value.toFixed(1),
  ratingLabel: (value: number) => `${value.toFixed(1)} / 10 puan`,
  /**
   * `releaseYear` is nullable (TMDB has undated entries), so parts are filtered
   * rather than interpolated — otherwise a missing year renders as "null · …".
   */
  movieMeta: (year: string | null, genreLabel?: string) =>
    [year, genreLabel].filter(Boolean).join(' · '),
  /**
   * `166 → "2s 46d"`. The minutes part is kept even at zero (`180 → "3s 0d"`).
   *
   * Currently unused: TMDB's `/discover/movie` does not return runtime (that
   * needs a per-movie details call), so the list row's meta line omits it. Kept
   * for when the details endpoint lands.
   */
  runtime: (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}s ${rest}d` : `${rest}d`;
  },
  /** Same line as `movieMeta`, plus runtime once the catalogue serves it. */
  movieMetaLong: (
    year: string | null,
    genreLabel?: string,
    runtime?: string,
  ) => [year, genreLabel, runtime].filter(Boolean).join(' · '),
} as const;
