import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getGenres } from "@/lib/api";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

/**
 * This is the app's **root layout** — there is no `app/layout.tsx`.
 *
 * With `localePrefix: 'always'` every route lives under `[locale]`, so the
 * `<html>` element has to be rendered here: it is the only place the active
 * language is known, and `lang` on `<html>` is what screen readers and the
 * browser's own hyphenation read.
 */

type LocaleParams = { params: Promise<{ locale: string }> };

/** So `/tr` gets Turkish `<title>` and description, not English ones. */
export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

/** Lets Next prerender the shell for each language rather than per request. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: React.ReactNode }) {
  const { locale } = await params;

  // The middleware should never let an unknown locale through, but a direct
  // request that bypasses it must 404 rather than render an untranslated shell.
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  // Cached 24h *per locale* by `getGenres` (the `lang` param is part of the
  // URL Next keys its fetch cache on), so this costs the layout nothing per
  // request; the typeahead needs it to name each result's genre.
  const genres = await getGenres(locale as Locale);

  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html>
    // before React hydrates, so the server/client markup differs by design.
    <html
      lang={locale}
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      {/* Column layout so the footer sits at the bottom on short pages. */}
      <body
        className={cn(
          "flex min-h-screen flex-col",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        {/*
          Wraps the whole tree so any client component can call
          `useTranslations`. Messages for the active locale are supplied by
          `i18n/request.ts`; passing none explicitly hands down all of them.
        */}
        <NextIntlClientProvider>
          <Providers>
            <Navbar genres={genres} />
            <div className="flex-1">{children}</div>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
