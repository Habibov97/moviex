import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@moviex/shared-types';

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
 */
export default async function MyListPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <MyListView />
    </Suspense>
  );
}
