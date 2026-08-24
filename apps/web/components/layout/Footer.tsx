import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';

export type FooterProps = {
  className?: string;
};

/**
 * Three lines of text in one row. That is the whole footer.
 *
 * It has been through a brand block with link columns, then a slim bar with the
 * nav links on it; this replaces both. **Nothing in here is a link** — the two
 * routes worth linking to are already in the navbar, and everything the earlier
 * versions pointed at besides them (Statistics, Privacy, Terms, Contact) was a
 * page that never existed. A footer with no links cannot go stale when a route
 * is renamed, which is the failure mode both previous versions had.
 *
 * The attribution is the one item that is not decoration: crediting TMDB is a
 * condition of using their data, so it stays whatever else changes.
 */
export async function Footer({ className }: FooterProps) {
  const t = await getTranslations('footer');

  // Server component, so this is baked in at build time rather than drifting
  // per-visitor — fine for a copyright line, and it avoids a hydration mismatch.
  // Passed as a string so it renders "2026", not a grouped "2,026".
  const year = String(new Date().getFullYear());

  return (
    <footer
      className={cn(
        'w-full border-t-[0.5px] border-mx-border-subtle bg-mx-footer font-mx',
        // 22px is off the spacing scale, hence the arbitrary value; 20px is px-5.
        'px-5 py-[22px]',
        /*
         * `justify-center` until `sm`, `justify-between` above it. Once the row
         * wraps, spreading three items across the full width leaves two of them
         * pinned to opposite edges with a gap down the middle — centred reads as
         * deliberate at that size, and the single row is unaffected.
         */
        'flex flex-wrap items-center justify-center gap-3 sm:justify-between',
        'text-[13px] text-mx-fg-faint',
        className,
      )}
    >
      <p>{t('author')}</p>
      <p>{t('copyright', { year })}</p>
      <p>{t('attribution')}</p>
    </footer>
  );
}

export default Footer;
