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
 */
export const NAV_LINKS: NavLink[] = [
  { href: '/', messageKey: 'discover' },
  { href: '/my-list', messageKey: 'myList' },
];
