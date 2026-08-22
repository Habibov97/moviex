import type { NavLink } from './navigation';

/**
 * Footer content. Separate from `NAV_LINKS`: the footer's product column is not
 * the primary nav (it lists Statistics and omits Watched), so the two
 * are deliberately not the same array.
 */

export type FooterColumn = {
  title: string;
  links: NavLink[];
};

// TODO: only `/` exists so far — the rest 404 until their routes are built.
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { href: '/', label: 'Discover' },
      { href: '/my-list', label: 'My list' },
      { href: '/istatistikler', label: 'Statistics' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/gizlilik', label: 'Privacy' },
      { href: '/sartlar', label: 'Terms' },
      { href: '/iletisim', label: 'Contact' },
    ],
  },
];

export const FOOTER_COPY = {
  /**
   * The reference's middle clause promised rating, which is deliberately not
   * part of the product (see the movie list flow in CLAUDE.md), so it promises
   * the action that actually exists.
   */
  tagline:
    'Track what you want to watch, mark what you have seen, and grow your collection.',
  navLabel: 'Footer',
  copyright: (year: number) => `© ${year} MovieX`,
  author: 'Created by Najaf Habibov',
  attribution: 'Movie data provided by TMDB',
} as const;
