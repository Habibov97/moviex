import type { NavLink } from './navigation';

/**
 * Footer content. Separate from `NAV_LINKS`: the footer's product column is not
 * the primary nav (it lists İstatistikler and omits İzlediklerim), so the two
 * are deliberately not the same array.
 */

export type FooterColumn = {
  title: string;
  links: NavLink[];
};

// TODO: only `/` exists so far — the rest 404 until their routes are built.
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Ürün',
    links: [
      { href: '/', label: 'Keşfet' },
      { href: '/listem', label: 'Listem' },
      { href: '/istatistikler', label: 'İstatistikler' },
    ],
  },
  {
    title: 'Hakkında',
    links: [
      { href: '/gizlilik', label: 'Gizlilik' },
      { href: '/sartlar', label: 'Şartlar' },
      { href: '/iletisim', label: 'İletişim' },
    ],
  },
];

export const FOOTER_COPY = {
  /**
   * The reference reads "…izlediklerini puanla…", but rating is deliberately not
   * part of the product (see the movie list flow in CLAUDE.md), so the middle
   * clause promises the action that actually exists.
   */
  tagline: 'İzleyeceklerini takip et, izlediklerini işaretle, koleksiyonunu büyüt.',
  navLabel: 'Alt menyu',
  copyright: (year: number) => `© ${year} MovieX`,
  author: 'Created by Najaf Habibov',
  attribution: 'Film verileri TMDB tarafından sağlanmaktadır',
} as const;
