/**
 * The app's languages: `apps/web` builds its routes, message files and
 * language switcher from these, and `apps/api` type-checks the `lang` query
 * param every `/tmdb/*` endpoint accepts against the same `Locale` union.
 *
 * **Values here are for `apps/web` only.** The API imports `Locale` as a
 * *type* and never a value, because this package ships raw `.ts` with
 * extensionless barrel re-exports that Node cannot resolve — Next transpiles
 * it, `node dist/main` cannot. The API's own `src/tmdb/tmdb-language.ts` holds
 * the runtime list and the TMDB tag mapping, tied back to `Locale` with
 * `satisfies`, so adding a language here fails to compile there until it is
 * mapped.
 */

export const LOCALES = ['en', 'tr', 'ru'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English. Unlike the filter defaults, this one **is** written to the URL —
 * see the `localePrefix: 'always'` note in CLAUDE.md for why.
 */
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Each language named in **its own** language, never translated into the
 * current one: someone who has landed on a locale they cannot read needs to
 * recognise their own language in the list to get out of it.
 */
export const LOCALE_NATIVE_NAMES = {
  en: 'English',
  tr: 'Türkçe',
  ru: 'Русский',
} as const satisfies Record<Locale, string>;
