import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';

import { routing } from './routing';

/**
 * Per-request i18n config, read by every `getTranslations()` on the server and
 * handed to `NextIntlClientProvider` for the client tree.
 *
 * The whole message file for the active locale is loaded — the app is small
 * enough that splitting messages per route would cost more in bookkeeping than
 * it saves in bytes.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // A hand-edited `/de/...` falls back rather than throwing: the middleware
  // should never let one through, but a 404-shaped crash would be worse than
  // English.
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
