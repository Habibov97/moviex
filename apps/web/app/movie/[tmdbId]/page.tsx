import { notFound } from 'next/navigation';
import Image from 'next/image';
import { IconStarFilled } from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import { posterTone } from '@/lib/poster-tone';
import { MovieBackdrop } from '@/components/movie/MovieBackdrop';
import { MovieActions } from '@/components/movie/MovieActions';
import { TopCast } from '@/components/movie/TopCast';
import { getMovieDetail } from '@/lib/api';
import {
  DETAIL_COPY,
  DISCOVER_COPY,
  formatLanguage,
  formatReleaseDate,
} from '@/lib/constants/discover';

type MoviePageProps = {
  params: Promise<{ tmdbId: string }>;
};

export default async function MoviePage({ params }: MoviePageProps) {
  const { tmdbId } = await params;
  const id = Number(tmdbId);

  // A non-numeric segment can't be a TMDB id — 404 without a round trip.
  if (!Number.isInteger(id) || id < 1) notFound();

  // Cached an hour (see lib/api.ts): a movie is a stable resource, unlike
  // search and discover results.
  const movie = await getMovieDetail(id);
  if (!movie) notFound();

  // Deterministic per movie, so the placeholder tint is stable across visits.
  const toneIndex = movie.tmdbId;

  const formattedRating = DISCOVER_COPY.rating(movie.rating);
  // Widened on purpose: `DETAIL_COPY` is `as const`, so without this the
  // labels infer as literal types and the filter predicate cannot narrow.
  const details: { label: string; value: string | null }[] = [
    { label: DETAIL_COPY.director, value: movie.directors.join(', ') || null },
    {
      label: DETAIL_COPY.releaseDate,
      value: formatReleaseDate(movie.releaseDate),
    },
    {
      label: DETAIL_COPY.runtime,
      value: movie.runtime ? DETAIL_COPY.runtimeLong(movie.runtime) : null,
    },
    {
      label: DETAIL_COPY.originalLanguage,
      value: formatLanguage(movie.originalLanguage),
    },
    { label: DETAIL_COPY.status, value: movie.status },
    { label: DETAIL_COPY.originalTitle, value: movie.originalTitle },
    // A field TMDB has no value for is dropped, not rendered as an empty row.
  ].flatMap((row) => (row.value ? [{ label: row.label, value: row.value }] : []));

  return (
    <main className="font-mx">
      <MovieBackdrop
        backdropUrl={movie.backdropUrl}
        title={movie.title}
        toneIndex={toneIndex}
        trailer={movie.trailer}
      />

      {/*
        Edge padding only — no max width and no centering, same as Discover
        and Search. `md:px-8` just keeps content off the viewport edge on a
        large screen; the content itself still fills the available width.
      */}
      <div className="px-4 sm:px-6 md:px-8">
        {/* Pulled up over the backdrop band. */}
        <div className="-mt-14 flex items-start gap-4 md:-mt-24 md:gap-6">
          <div
            className={cn(
              'relative aspect-[2/3] w-[118px] shrink-0 overflow-hidden rounded-[10px] md:w-[200px] md:rounded-[12px]',
              // A light hairline plus a lift shadow — NOT a page-coloured
              // border, which would only separate the poster from the page and
              // leave its top half dissolved into the backdrop it overlaps.
              'border-[0.5px] border-mx-poster-edge shadow-[0_8px_28px_var(--mx-poster-shadow)]',
              posterTone(toneIndex),
            )}
          >
            {movie.posterUrl && (
              <Image
                src={movie.posterUrl}
                alt=""
                fill
                sizes="(min-width: 768px) 200px, 118px"
                className="object-cover"
              />
            )}
          </div>

          <div className="min-w-0 flex-1 pt-16 md:pt-28">
            <h1 className="text-[23px] leading-tight font-medium text-mx-fg md:text-[38px]">
              {movie.title}
            </h1>

            {movie.tagline && (
              <p className="mt-1 text-[13.5px] text-mx-fg-subtle italic md:mt-2 md:text-[15px]">
                {movie.tagline}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mx-fg-faint md:mt-4 md:gap-x-4 md:text-[14px]">
              {formattedRating && (
                <span className="flex items-center gap-1.5">
                  <IconStarFilled
                    className="size-3.5 text-mx-accent md:size-4"
                    aria-hidden="true"
                  />
                  <span className="font-medium text-mx-fg tabular-nums md:text-[17px]">
                    {formattedRating}
                  </span>
                  <span>{DETAIL_COPY.ratingScale}</span>
                </span>
              )}
              {movie.releaseYear && (
                <>
                  {formattedRating && <Dot />}
                  <span>{movie.releaseYear}</span>
                </>
              )}
              {movie.runtime && (
                <>
                  {(formattedRating || movie.releaseYear) && <Dot />}
                  <span>{DETAIL_COPY.runtimeShort(movie.runtime)}</span>
                </>
              )}
            </div>

            {movie.genres.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 md:mt-4 md:gap-2.5">
                {movie.genres.map((genre) => (
                  <li
                    key={genre.id}
                    className="inline-flex h-7 items-center rounded-full border-[0.5px] border-mx-border bg-mx-chip px-3 text-[12.5px] text-mx-fg-muted md:h-9 md:px-[15px] md:text-[13px]"
                  >
                    {genre.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/*
          Status is hard-coded until the user-movies module exists; it is a prop
          so wiring the real source later is a one-line change here.
        */}
        <div className="mt-6 md:mt-8">
          <MovieActions tmdbId={movie.tmdbId} status={null} isSignedIn={false} />
        </div>

        <section className="mt-8 border-t-[0.5px] border-mx-border-subtle pt-6 md:mt-10 md:pt-7">
          <h2 className="text-[13px] font-medium text-mx-fg md:text-[15px]">
            {DETAIL_COPY.overview}
          </h2>
          <p
            className={cn(
              'mt-3 max-w-[62ch] text-[13.5px] leading-[1.7] md:mt-4 md:max-w-[68ch] md:text-[14.5px]',
              movie.overview ? 'text-mx-fg-muted' : 'text-mx-fg-faint',
            )}
          >
            {movie.overview ?? DETAIL_COPY.noOverview}
          </p>
        </section>

        <div className="mt-8 border-t-[0.5px] border-mx-border-subtle pt-6 md:mt-10 md:pt-7">
          <TopCast cast={movie.cast} />
        </div>

        {details.length > 0 && (
          <section className="mt-8 border-t-[0.5px] border-mx-border-subtle pt-6 pb-10 md:mt-10 md:pt-7 md:pb-14">
            <h2 className="text-[13px] font-medium text-mx-fg md:text-[15px]">
              {DETAIL_COPY.details}
            </h2>
            <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-6 gap-y-5 md:mt-5 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] md:gap-x-8 md:gap-y-6">
              {details.map((row) => (
                <div key={row.label}>
                  <dt className="text-[11.5px] text-mx-fg-faint md:text-[12px]">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-[13px] text-mx-fg md:text-[14px]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-mx-fg-faint">
      ·
    </span>
  );
}
