import { DiscoverHero } from '@/components/discover/DiscoverHero';
import { MovieGrid } from '@/components/discover/MovieGrid';

export default function Home() {
  return (
    <main>
      <DiscoverHero />
      {/*
        Both fall back to the placeholder catalogue. Handler props are left off
        on purpose — this is a server component, so callbacks cannot cross the
        boundary; they get passed once a client-side data layer owns the page.
      */}
      <MovieGrid />
    </main>
  );
}
