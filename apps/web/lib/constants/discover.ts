import { type MovieSortId } from '@moviex/shared-types';

/**
 * Structure and defaults for the Discover screens — **no copy**.
 *
 * Every user-visible string now lives in `messages/{en,tr,ru}.json` and is read
 * through `useTranslations('discover')` / `getTranslations('discover')`. What
 * stays here is the vocabulary the URL and the API speak: search-param names,
 * their parsers, and the option ids those parsers produce. An option's *label*
 * is a message key derived from its `id`, so adding a sort order means adding
 * one entry here and one key in each message file.
 *
 * Still no catalogue data: genres come from `GET /tmdb/genres` and films from
 * `GET /tmdb/discover`.
 */

/**
 * The reset chip's id. Not a TMDB genre — it clears the filter rather than
 * applying one — so it is rendered separately from the fetched list, and `null`
 * is what "no genre selected" means throughout. Its label is
 * `discover.allGenres`.
 */

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
 *
 * Locale-free: it is always passed to the `Link` / `redirect` / `useRouter`
 * from `@/i18n/navigation`, which adds the active locale's prefix.
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

/** The four presets the year popover offers, in the order it renders them. */
export type YearPresetId = 'thisYear' | 'last5' | 'last10' | 'classics';

/**
 * `id` doubles as the message key suffix (`discover.presetThisYear`), so a
 * preset cannot exist without a label in every language.
 */
export const YEAR_PRESETS: ReadonlyArray<{
  id: YearPresetId;
  messageKey: string;
  range: { from: number; to: number };
}> = [
  {
    id: 'thisYear',
    messageKey: 'presetThisYear',
    range: { from: CURRENT_YEAR, to: CURRENT_YEAR },
  },
  {
    id: 'last5',
    messageKey: 'presetLast5',
    range: { from: CURRENT_YEAR - 5, to: CURRENT_YEAR },
  },
  {
    id: 'last10',
    messageKey: 'presetLast10',
    range: { from: CURRENT_YEAR - 10, to: CURRENT_YEAR },
  },
  {
    id: 'classics',
    messageKey: 'presetClassics',
    range: { from: EARLIEST_YEAR, to: CLASSICS_UNTIL_YEAR },
  },
];

/**
 * The orderings the sort dropdown offers.
 *
 * `id` is what goes in the URL and `sortBy` is TMDB's `sort_by` value — kept
 * apart so the address bar carries `?sort=rating` rather than leaking
 * `vote_average.desc`, and so changing TMDB's vocabulary never breaks a
 * bookmarked link. The API validates the `sortBy` half against its own
 * whitelist. The visible label is `discover.sort.<id>` in the message files.
 */
export const SORT_OPTIONS: ReadonlyArray<{
  id: MovieSortId;
  sortBy: string;
}> = [
  { id: 'popularity', sortBy: 'popularity.desc' },
  { id: 'rating', sortBy: 'vote_average.desc' },
  { id: 'newest', sortBy: 'primary_release_date.desc' },
  { id: 'oldest', sortBy: 'primary_release_date.asc' },
];

/** Pre-selected, and the one ordering never written to the URL. */
export const DEFAULT_SORT_ID: MovieSortId = 'popularity';

/** Unknown or absent values fall back to the default rather than erroring. */
export function parseSortParam(value: string | undefined): MovieSortId {
  return (
    SORT_OPTIONS.find((option) => option.id === value)?.id ?? DEFAULT_SORT_ID
  );
}

/** `MovieSortId` → TMDB `sort_by`. The only place the mapping lives. */
export function sortByFor(id: MovieSortId): string {
  return (
    SORT_OPTIONS.find((option) => option.id === id)?.sortBy ??
    SORT_OPTIONS[0]!.sortBy
  );
}

export type ViewModeId = 'grid' | 'list';

/** Labels are `discover.view.<id>`. */
export const VIEW_MODES = ['grid', 'list'] as const satisfies ReadonlyArray<ViewModeId>;

export const DEFAULT_VIEW_MODE: ViewModeId = 'grid';

/** Cards rendered while the first page is still in flight. */
export const SKELETON_CARD_COUNT = 8;

/** Cast members shown before "View all" expands to the full list. */
export const VISIBLE_CAST_COUNT = 5;

/**
 * How a score is rendered: always one decimal, matching the reference badges
 * ("8.4"). Passed to next-intl's `format.number`, **not** `toFixed`, so the
 * separator follows the locale — Russian writes `8,4`.
 */
export const RATING_NUMBER_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;

/**
 * Two digits, so the ranks stay in one column down the list. Punctuation, not
 * copy — every language numbers rows the same way.
 */
export function rankLabel(position: number): string {
  return String(position).padStart(2, '0');
}

/**
 * `year · genre [· runtime]`, dropping whatever is missing.
 *
 * The separator is a middle dot in all three languages, so this stays a plain
 * join rather than a message: `releaseYear` is nullable (TMDB has undated
 * entries), and interpolating it would render "null · …".
 */
export function movieMeta(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

/**
 * `2024-02-27` → a `Date`, or `null` for a missing or unparseable value so the
 * details grid can skip the row entirely.
 *
 * Only parsing lives here; the *formatting* is done by next-intl's formatter at
 * the call site, which knows the active locale.
 */
export function parseIsoDate(isoDate: string | null): Date | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `2024-02-27` in the details grid: "February 27, 2024" / "27 февраля 2024 г." */
export const RELEASE_DATE_FORMAT = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  // TMDB dates are plain calendar days; without this a UTC midnight can render
  // as the previous day west of Greenwich.
  timeZone: 'UTC',
} as const;

/** `2026-08-21T…` → `Aug 21`, matching My List's short captions. */
export const SHORT_DATE_FORMAT = {
  month: 'short',
  day: 'numeric',
} as const;

/**
 * `en` → `English` / `İngilizce` / `английский`, in the **active** locale.
 *
 * Uses `Intl.DisplayNames` rather than a hand-maintained map — TMDB can return
 * any ISO 639-1 code, and a partial map would render raw codes for the long
 * tail (and would need translating three times over).
 */
export function formatLanguage(
  code: string | null,
  locale: string,
): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
