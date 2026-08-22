import type { Locale } from '@moviex/shared-types';

/**
 * Our locale → TMDB's `language` parameter.
 *
 * TMDB wants a full IETF tag (`tr-TR`); our wire vocabulary is a bare ISO
 * 639-1 code (`tr`), which is also what the frontend's URLs carry. Keeping the
 * two apart means a change in TMDB's vocabulary never invalidates a bookmarked
 * link — the same split as `MovieSortId` → `sort_by`.
 *
 * **This lives in `apps/api`, not `@moviex/shared-types`, for two reasons.**
 * One: TMDB's wire format is only ever read here, so the mapping belongs
 * beside the code that calls TMDB. Two, and load-bearing: `shared-types` ships
 * raw `.ts` source with extensionless barrel re-exports, which Node cannot
 * resolve — the web app gets away with it because Next transpiles the package,
 * but `node dist/main` cannot. So the API may import **types** from that
 * package (erased at compile time) but never *values*.
 *
 * `satisfies Record<Locale, string>` is what keeps the two ends honest: adding
 * a fourth language to `LOCALES` fails to compile here until it has a TMDB tag,
 * the same trick `GenreDto implements Genre` uses.
 */
export const TMDB_LANGUAGE = {
  en: 'en-US',
  tr: 'tr-TR',
  ru: 'ru-RU',
} as const satisfies Record<Locale, string>;

/**
 * The accepted `lang` values, derived from the map above rather than written
 * out again — so the validator cannot list a locale the mapping lacks.
 */
export const API_LOCALES = Object.keys(TMDB_LANGUAGE) as Locale[];

/** English: what an omitted `lang` means, and the fallback for missing prose. */
export const DEFAULT_LOCALE: Locale = 'en';

export const DEFAULT_TMDB_LANGUAGE = TMDB_LANGUAGE[DEFAULT_LOCALE];

export function toTmdbLanguage(locale: Locale | undefined): string {
  return locale ? TMDB_LANGUAGE[locale] : DEFAULT_TMDB_LANGUAGE;
}
