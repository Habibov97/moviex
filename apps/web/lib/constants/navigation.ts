import { DISCOVER_HREF } from './discover';

export type NavLink = {
  /** Locale-free, e.g. `/my-list` — the locale prefix is added by `Link`. */
  href: string;
  /** Key under the `nav` namespace, not a label. */
  messageKey: string;
  /**
   * Whether clicking this needs a session.
   *
   * A gated link still renders a real `<a href>` — the navbar only intercepts
   * the click, so middle-click, "copy link address" and a JS-less load all
   * still reach the route, where its own signed-out state takes over. This
   * flag is the common-path UX, not the protection.
   *
   * It lives here rather than as an `href === '/my-list'` test in `Navbar`
   * for the usual reason: the list of routes and their properties is this
   * file's job, and a hard-coded path in the component is one more place to
   * remember when a route is renamed.
   */
  requiresAuth?: boolean;
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
 * **The navbar is the only thing that renders this array.** The footer used to
 * keep its own `FOOTER_COLUMNS` and drifted into advertising four pages that
 * were never built; it now contains no links at all, so there is exactly one
 * place to update when a route is added or removed — here.
 */
export const NAV_LINKS: NavLink[] = [
  { href: DISCOVER_HREF, messageKey: 'discover' },
  /*
   * Gated: a signed-out click opens the auth modal instead of navigating.
   * The link is deliberately *not* hidden for signed-out visitors — it is the
   * clearest reason this app has to offer for creating an account, which is
   * the same argument that keeps the detail page's Add/Watched buttons
   * enabled and full-colour rather than disabled.
   */
  { href: '/my-list', messageKey: 'myList', requiresAuth: true },
];
