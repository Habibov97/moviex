import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';
import { Link } from '@/i18n/navigation';
import { BrandMark } from '@/components/layout/BrandMark';
import { FOOTER_COLUMNS } from '@/lib/constants/footer';

export type FooterProps = {
  className?: string;
};

export async function Footer({ className }: FooterProps) {
  const t = await getTranslations('footer');

  // Server component, so this is baked in at build time rather than drifting
  // per-visitor — fine for a copyright line, and it avoids a hydration mismatch.
  // Passed as a string so it renders "2026", not a grouped "2,026".
  const year = String(new Date().getFullYear());

  return (
    <footer className={cn('w-full border-t-[0.5px] border-mx-border-subtle bg-mx-nav font-mx', className)}>
      <div className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
          <div className="min-w-0">
            <BrandMark size="lg" />
            <p className="mt-5 max-w-sm text-[16px] leading-[1.65] text-mx-fg-subtle">{t('tagline')}</p>
          </div>

          <nav aria-label={t('navLabel')} className="grid shrink-0 grid-cols-2 gap-x-16 gap-y-10 sm:gap-x-24">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.titleKey}>
                <h2 className="text-[15px] font-semibold tracking-tight text-mx-fg">{t(column.titleKey)}</h2>
                <ul className="mt-5 space-y-4">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[15px] text-mx-fg-subtle outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg"
                      >
                        {t(link.messageKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t-[0.5px] border-mx-border-subtle pt-8 text-[14px] text-mx-fg-faint sm:flex-row sm:items-center sm:justify-between">
          {/*
            The byline rides with the copyright rather than getting its own row:
            same "who made this" register, and it keeps the bottom bar to the two
            balanced ends the reference draws.
          */}

          <Link href="https://www.linkedin.com/in/najafhabibov/" className="text-mx-fg-subtle">
            {t('author')}
          </Link>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span aria-hidden="true" className="text-mx-border">
              ·
            </span>
            <span>{t('copyright', { year })}</span>
            <span aria-hidden="true" className="text-mx-border">
              ·
            </span>
          </p>
          <p>{t('attribution')}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
