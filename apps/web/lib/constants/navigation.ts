export type NavLink = {
  href: string;
  label: string;
};

/**
 * The primary navigation. Unlike the movie categories these are app routes, not
 * catalogue data — they never come from the backend, so the list stays static
 * and is simply passed to `<Navbar />`.
 */
export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Discover' },
  { href: '/my-list', label: 'My list' },
  { href: '/izlediklerim', label: 'Watched' },
];
