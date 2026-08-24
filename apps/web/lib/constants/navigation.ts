import { DISCOVER_HREF } from './discover';

export type NavLink = {
  /** Locale-free, e.g. `/my-list` — the locale prefix is added by `Link`. */
  href: string;
  /** Key under the `nav` namespace, not a label. */
  messageKey: string;
};

/**
 * The primary navigation. Unlike the movie genres these are app routes, not
 * catalogue data — they never come from the backend, so the list stays static
 * and is simply passed to `<Navbar />`. The label for each comes from
 * `useTranslations('nav')`.
 */
/*
 * Two entries, deliberately. A standalone "Watched" link was removed once My
 * List grew its own Watchlist/Watched tabs — the tab is the canonical way in,
 * and the link pointed at a `/izlediklerim` route that never existed.
 *
 * **The footer renders this same array**, so the two cannot list different
 * routes. It used to keep its own `FOOTER_COLUMNS`, which is how it ended up
 * still advertising four pages that were never built. One list, one place to
 * update when a route is added or removed.
 */
export const NAV_LINKS: NavLink[] = [
  { href: DISCOVER_HREF, messageKey: 'discover' },
  { href: '/my-list', messageKey: 'myList' },
];
