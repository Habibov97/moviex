import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@moviex/shared-types';

import { getGenres } from '@/lib/api';
import { MyListView } from '@/components/my-list/MyListView';

/**
 * `/{locale}/my-list`.
 *
 * A thin shell: the session lives in a cookie the client reads via
 * `useCurrentUser`, so the page itself is not a data-fetching Server
 * Component — the view owns the query and the signed-out redirect. The locale
 * middleware is not an auth guard, so nesting under `[locale]` changed nothing
 * about how this page protects itself.
 *
 * Suspense because the view reads `useSearchParams` for its tab and sort.
 *
 * The one thing it *does* fetch is the genre list, for the "top genre" stat.
 * Saved rows store a genre **id**, so the name has to be resolved in the
 * current locale — fetching it here follows the same pattern Discover and
 * Search use (Server Component fetches, passes down as a prop, never client
 * state) and costs nothing extra: `getGenres` is `revalidate: 86400` and keyed
 * per locale, so these three pages share one cached response per language.
 */
export default async function MyListPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const genres = await getGenres(locale);

  return (
    <Suspense>
      <MyListView genres={genres} />
    </Suspense>
  );
}
