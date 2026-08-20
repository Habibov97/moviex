"use client";

import { useState } from "react";
import Image from "next/image";
import { IconUser } from "@tabler/icons-react";
import type { CastMember } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { posterTone } from "@/lib/poster-tone";
import { DETAIL_COPY, VISIBLE_CAST_COUNT } from "@/lib/constants/discover";

/**
 * Top cast, five at a time.
 *
 * "View all" is a pure client toggle — the API already returned all ten, so
 * expanding costs no request.
 */
export function TopCast({ cast }: { cast: CastMember[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (cast.length === 0) return null;

  const shown = isExpanded ? cast : cast.slice(0, VISIBLE_CAST_COUNT);
  const canExpand = cast.length > VISIBLE_CAST_COUNT;

  return (
    <section className="font-mx">
      <div className="flex items-center gap-4">
        <h2 className="text-[13px] font-medium text-mx-fg md:text-[15px]">
          {DETAIL_COPY.topCast}
        </h2>
        {canExpand && (
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            className="ml-auto text-[12px] text-mx-accent outline-none transition-colors hover:text-mx-accent-hover focus-visible:underline md:text-[13.5px]"
          >
            {isExpanded ? DETAIL_COPY.viewFewer : DETAIL_COPY.viewAll}
          </button>
        )}
      </div>

      {/* Still wrapping, just at a wider cell — no fixed column count. */}
      <ul className="mt-4 flex flex-wrap gap-4 md:mt-5 md:gap-5">
        {shown.map((member, index) => (
          <li key={member.id} className="w-[76px] text-center md:w-24">
            <span
              className={cn(
                "relative mx-auto block size-14 overflow-hidden rounded-full md:size-[76px]",
                // Same deterministic tint the posters fall back to, so a
                // headshot-less cast row still reads as people, not holes.
                !member.profileUrl && posterTone(index),
              )}
            >
              {member.profileUrl ? (
                <Image
                  src={member.profileUrl}
                  alt=""
                  width={96}
                  height={96}
                  className="size-full object-cover"
                />
              ) : (
                <IconUser
                  className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-mx-fg-faint md:size-7"
                  stroke={1.5}
                  aria-hidden="true"
                />
              )}
            </span>

            <span className="mt-2 block text-[11px] leading-tight font-medium text-mx-fg md:text-[13px]">
              {member.name}
            </span>
            {member.character && (
              <span className="mt-0.5 block text-[10px] leading-tight text-mx-fg-faint md:text-[11.5px]">
                {member.character}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default TopCast;
