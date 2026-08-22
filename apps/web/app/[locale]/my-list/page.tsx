import { Suspense } from 'react';

import { MyListView } from '@/components/my-list/MyListView';

/**
 * `/my-list`.
 *
 * A thin shell: the session lives in a cookie the client reads via
 * `useCurrentUser`, so the page itself is not a data-fetching Server
 * Component — the view owns the query and the signed-out redirect.
 *
 * Suspense because the view reads `useSearchParams` for its tab and sort.
 */
export default function MyListPage() {
  return (
    <Suspense>
      <MyListView />
    </Suspense>
  );
}
