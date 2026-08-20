/**
 * Deterministic placeholder tints for missing artwork.
 *
 * Lives here rather than in `MovieCard` because that file is `"use client"`,
 * and a Server Component calling a function exported from a client module is a
 * runtime error — the movie detail page hit exactly that. This is a pure
 * function with no React in it, so both sides can share it.
 *
 * Full class strings on purpose: Tailwind only emits classes it can read in the
 * source, so `bg-mx-poster-${n}` would compile to nothing.
 */
export const POSTER_TONES = [
  "bg-mx-poster-1",
  "bg-mx-poster-2",
  "bg-mx-poster-3",
  "bg-mx-poster-4",
  "bg-mx-poster-5",
  "bg-mx-poster-6",
  "bg-mx-poster-7",
  "bg-mx-poster-8",
] as const;

/** Any integer works — grid index, list position, or a stable TMDB id. */
export function posterTone(index: number) {
  return POSTER_TONES[Math.abs(index) % POSTER_TONES.length];
}
