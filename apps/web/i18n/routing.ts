import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@moviex/shared-types';

/**
 * Locale routing.
 *
 * **`localePrefix: 'always'`** — every URL carries its language, English
 * included (`/en`, `/en/movie/603`), rather than leaving the default
 * unprefixed. Two reasons specific to this app:
 *
 * 1. The locale is not only a UI setting — it is forwarded to TMDB as the
 *    `lang` param, so titles, overviews and genre names change with it. An
 *    unprefixed `/movie/603` would therefore render *different content* for
 *    different visitors depending on their `Accept-Language`, and a link shared
 *    between two people would not show the same film description. With `always`
 *    a URL means exactly one thing.
 * 2. Every route has one canonical shape, so the language switcher is a plain
 *    segment swap and the "preserve the current path" rule needs no special
 *    case for the default language.
 *
 * The cost is a redirect on `/` → `/en` (or the detected locale). That is one
 * hop on first visit, which is worth the URLs being unambiguous.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
