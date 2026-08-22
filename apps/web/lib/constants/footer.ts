import type { NavLink } from './navigation';

/**
 * Footer structure. Separate from `NAV_LINKS`: the footer's product column is
 * not the primary nav (it lists Statistics and omits Watched), so the two are
 * deliberately not the same array.
 *
 * Titles and link labels are keys under the `footer` namespace — no copy here.
 */

export type FooterColumn = {
  /** Key under `footer`, e.g. `columnProduct`. */
  titleKey: string;
  links: NavLink[];
};

// TODO: only `/` and `/my-list` exist so far — the rest 404 until their routes
// are built.
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    titleKey: 'columnProduct',
    links: [
      { href: '/', messageKey: 'discover' },
      { href: '/my-list', messageKey: 'myList' },
      { href: '/istatistikler', messageKey: 'statistics' },
    ],
  },
  {
    titleKey: 'columnAbout',
    links: [
      { href: '/gizlilik', messageKey: 'privacy' },
      { href: '/sartlar', messageKey: 'terms' },
      { href: '/iletisim', messageKey: 'contact' },
    ],
  },
];
