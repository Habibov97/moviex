import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * **Import these, not the Next originals**, anywhere a route is written or
 * read. `Link href="/my-list"` renders `/tr/my-list` under Turkish without the
 * caller knowing, and `usePathname()` answers `/my-list` — the prefix stripped
 * — so `Navbar`'s active-link test and every `router.push` that rebuilds a
 * query string keep working on plain, locale-free paths.
 *
 * A raw `next/link` would drop the prefix and bounce the user back to the
 * default language through the middleware; a raw `usePathname` would return
 * `/tr/my-list` and quietly break both of those comparisons.
 *
 * `useSearchParams` and `notFound` are unaffected by the locale and still come
 * from `next/navigation`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
