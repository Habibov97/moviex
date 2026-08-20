"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconPlayerPlayFilled } from "@tabler/icons-react";
import type { MovieTrailer } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { posterTone } from "@/lib/poster-tone";
import { TrailerModal } from "@/components/movie/TrailerModal";
import { DETAIL_COPY, DISCOVER_HREF } from "@/lib/constants/discover";

/**
 * The 150px hero band: backdrop, darkening overlay, Back and Watch trailer.
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
  const router = useRouter();
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  return (
    <div
      className={cn(
        "relative h-[150px] w-full overflow-hidden md:h-[280px]",
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
        white button text below unreadable; and a film's backdrop and poster are
        drawn from the same palette, so without this the poster's top half —
        which overlaps this band — dissolves into it.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-mx-hero-overlay"
      />

      {/* Positioned against the backdrop itself — no inner column. */}
      <button
        type="button"
        onClick={() => {
          // Falls back to browsing when this page was opened directly.
          if (window.history.length > 1) router.back();
          else router.push(DISCOVER_HREF);
        }}
        className="absolute top-4 left-4 inline-flex h-8 items-center gap-2 rounded-[8px] border-[0.5px] border-mx-border bg-mx-hero-pill px-3 text-[13px] text-mx-poster-fg outline-none transition-colors hover:bg-mx-accent focus-visible:border-mx-accent md:top-6 md:left-8 md:h-10 md:px-4 md:text-[14.5px]"
      >
        <IconArrowLeft
          className="size-4 md:size-5"
          stroke={1.75}
          aria-hidden="true"
        />
        {DETAIL_COPY.back}
      </button>

      {/*
        Bottom-right, not centred: the poster overlaps upward from the left and
        a centred button would collide with it.
      */}
      {trailer && (
        <button
          type="button"
          onClick={() => setIsTrailerOpen(true)}
          className="absolute right-4 bottom-4 inline-flex h-9 items-center gap-2.5 rounded-[8px] border-[0.5px] border-mx-border bg-mx-hero-pill pr-4 pl-2 text-[13.5px] font-medium text-mx-poster-fg outline-none transition-colors hover:border-mx-accent focus-visible:border-mx-accent md:right-8 md:bottom-6 md:h-11 md:gap-3 md:pr-5 md:pl-2.5 md:text-[14.5px]"
        >
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-mx-accent md:size-7"
          >
            <IconPlayerPlayFilled className="size-3 text-mx-on-accent md:size-3.5" />
          </span>
          {DETAIL_COPY.watchTrailer}
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
