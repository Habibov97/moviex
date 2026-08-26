"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { IconArrowLeft, IconPlayerPlayFilled } from "@tabler/icons-react";
import type { MovieTrailer } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { posterTone } from "@/lib/poster-tone";
import { TrailerModal } from "@/components/movie/TrailerModal";
import { DISCOVER_HREF } from "@/lib/constants/discover";

/**
 * The 150px hero band: backdrop, darkening overlay, Back and Watch trailer.
 *
 * Two heights, deliberately different. The wrapper reserves the *hero* height
 * (150/280px) — that is what the content block's negative margin is measured
 * against, so it must not change — while the image itself is an absolutely
 * positioned layer that is taller (280/420px) and simply hangs below the flow,
 * behind the poster and the head of the content column. A gradient fades that
 * overhang into `--mx-bg` so it ends in the page rather than at a hard edge.
 *
 * Client-side for the two interactive controls — Back reads history, and the
 * trailer opens a modal.
 */
export function MovieBackdrop({
  backdropUrl,
  title,
  toneIndex,
  trailer,
}: {
  backdropUrl: string | null;
  title: string;
  /** Falls back to the shared poster tint when TMDB has no backdrop. */
  toneIndex: number;
  trailer: MovieTrailer | null;
}) {
  const t = useTranslations("detail");
  const router = useRouter();
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  return (
    <div className="relative h-[150px] w-full md:h-[280px]">
      {/*
        The image layer. Taller than the band above, and absolutely positioned
        so that extra height costs the flow nothing — everything below keeps the
        position it had. `z-0` pairs with the `relative z-10` on the page's
        content column, which is what keeps the title and meta row on top of the
        part of the image that now reaches under them.
      */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 z-0 h-[280px] overflow-hidden md:h-[420px]",
          !backdropUrl && posterTone(toneIndex),
        )}
      >
        {backdropUrl && (
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}

        {/*
          Not decoration. TMDB backdrops are frequently bright, which makes the
          white button text below unreadable; and a film's backdrop and poster
          are drawn from the same palette, so without this the poster's top half
          — which overlaps this band — dissolves into it. It covers the whole
          image, overhang included, and sits *under* the fade below.
        */}
        <div className="absolute inset-0 bg-mx-hero-overlay" />

        {/*
          The overhang only — from the hero's own bottom edge down. Starting at
          zero alpha exactly where the band ends means there is no seam, and
          landing on `--mx-bg` (a token, so it follows the theme) means the
          image ends in the page instead of being cut off mid-frame.

          Deliberately front-loaded rather than linear: the title clears the
          hero by only ~8px on mobile, so it sits on the first stretch of this
          fade. `--mx-fg` is near-black in the light theme, and a linear ramp
          would leave it on a still-dark photo. At 45% the image is already 85%
          gone, which puts everything from the tagline down on flat page.
        */}
        <div className="absolute inset-x-0 top-[150px] bottom-0 bg-linear-to-b from-mx-bg/0 via-mx-bg/85 via-45% to-mx-bg md:top-[280px]" />
      </div>

      {/* Positioned against the backdrop itself — no inner column. */}
      <button
        type="button"
        onClick={() => {
          // Falls back to browsing when this page was opened directly.
          if (window.history.length > 1) router.back();
          else router.push(DISCOVER_HREF);
        }}
        className="absolute top-4 left-4 z-10 inline-flex h-8 items-center gap-2 rounded-[8px] border-[0.5px] border-mx-border bg-mx-hero-pill px-3 text-[13px] text-mx-poster-fg outline-none transition-colors hover:bg-mx-accent focus-visible:border-mx-accent md:top-6 md:left-8 md:h-10 md:px-4 md:text-[14.5px]"
      >
        <IconArrowLeft
          className="size-4 md:size-5"
          stroke={1.75}
          aria-hidden="true"
        />
        {t("back")}
      </button>

      {/*
        Bottom-right, not centred: the poster overlaps upward from the left and
        a centred button would collide with it.
      */}
      {trailer && (
        <button
          type="button"
          onClick={() => setIsTrailerOpen(true)}
          className="absolute right-4 bottom-4 z-10 inline-flex h-9 items-center gap-2.5 rounded-[8px] border-[0.5px] border-mx-border bg-mx-hero-pill pr-4 pl-2 text-[13.5px] font-medium text-mx-poster-fg outline-none transition-colors hover:border-mx-accent focus-visible:border-mx-accent md:right-8 md:bottom-6 md:h-11 md:gap-3 md:pr-5 md:pl-2.5 md:text-[14.5px]"
        >
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-mx-accent md:size-7"
          >
            <IconPlayerPlayFilled className="size-3 text-mx-on-accent md:size-3.5" />
          </span>
          {t("watchTrailer")}
        </button>
      )}

      {trailer && (
        <TrailerModal
          trailer={trailer}
          isOpen={isTrailerOpen}
          onClose={() => setIsTrailerOpen(false)}
        />
      )}

      <span className="sr-only">{title}</span>
    </div>
  );
}

export default MovieBackdrop;
