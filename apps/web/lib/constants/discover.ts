import {
  ALL_CATEGORIES_ID,
  type DiscoverFilters,
  type Movie,
  type MovieCategory,
  type MovieSortId,
} from '@moviex/shared-types';

/**
 * Every label, option and default the discover ("Keşfet") screen renders.
 *
 * Nothing here is meant to stay hard-coded: the category list is a placeholder
 * for `GET /movies/categories`, and the result count for `GET /movies`. Both are
 * already typed against `@moviex/shared-types`, so swapping the constant for a
 * query result is a one-line change at the call site — the components take them
 * as props and never reach into this file themselves.
 */

/** Locale used for every number the discover screens format. */
export const DISCOVER_LOCALE = 'tr-TR';

/** The reset chip. Not a real genre, so it is kept out of `MOVIE_CATEGORIES`. */
export const ALL_CATEGORY: MovieCategory = {
  id: ALL_CATEGORIES_ID,
  label: 'Tümü',
};

// TODO: connect to /movies/categories
export const MOVIE_CATEGORIES: MovieCategory[] = [
  { id: 'action', label: 'Aksiyon' },
  { id: 'drama', label: 'Dram' },
  { id: 'sci-fi', label: 'Bilim kurgu' },
  { id: 'thriller', label: 'Gerilim' },
  { id: 'comedy', label: 'Komedi' },
  { id: 'adventure', label: 'Macera' },
  { id: 'animation', label: 'Animasyon' },
  { id: 'documentary', label: 'Belgesel' },
  { id: 'fantasy', label: 'Fantastik' },
  { id: 'horror', label: 'Korku' },
  { id: 'romance', label: 'Romantik' },
  { id: 'crime', label: 'Suç' },
  { id: 'history', label: 'Tarih' },
];

/** Genres rendered before the rest collapse behind the "+N" chip. */
export const VISIBLE_CATEGORY_COUNT = 5;

export const RELEASE_YEAR_RANGE = { from: 2020, to: 2026 } as const;

export const MIN_RATING = 7;

export const SORT_OPTIONS: ReadonlyArray<{ id: MovieSortId; label: string }> = [
  { id: 'popularity', label: 'Popülerlik' },
  { id: 'rating', label: 'Puan' },
  { id: 'release-date', label: 'Çıkış tarihi' },
  { id: 'title', label: 'Ad' },
];

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  categoryId: ALL_CATEGORIES_ID,
  yearFrom: RELEASE_YEAR_RANGE.from,
  yearTo: RELEASE_YEAR_RANGE.to,
  minRating: MIN_RATING,
  sort: 'popularity',
};

export type ViewModeId = 'grid' | 'list';

export const VIEW_MODES = [
  { id: 'grid', label: 'Izgara görünümü' },
  { id: 'list', label: 'Liste görünümü' },
] as const satisfies ReadonlyArray<{ id: ViewModeId; label: string }>;

export const DEFAULT_VIEW_MODE: ViewModeId = 'grid';

// TODO: connect to /movies (total of the current filter set)
export const PLACEHOLDER_RESULT_COUNT = 1248;

/**
 * The eight films the design reference shows, in its order.
 *
 * `posterUrl` is deliberately absent everywhere — the catalogue serves no
 * artwork yet, so every card renders its skeleton tone, which is exactly the
 * state the reference was designed in.
 */
// TODO: connect to /movies (first page of the current filter set)
export const PLACEHOLDER_MOVIES: Movie[] = [
  {
    id: 'dune-part-two',
    title: 'Dune: Part two',
    year: 2024,
    categoryId: 'sci-fi',
    rating: 8.4,
  },
  {
    id: 'oppenheimer',
    title: 'Oppenheimer',
    year: 2023,
    categoryId: 'drama',
    rating: 8.1,
    userState: 'watched',
  },
  {
    id: 'blade-runner-2049',
    title: 'Blade Runner 2049',
    year: 2017,
    categoryId: 'sci-fi',
    rating: 8.0,
  },
  {
    id: 'interstellar',
    title: 'Interstellar',
    year: 2014,
    categoryId: 'sci-fi',
    rating: 8.6,
    userState: 'listed',
  },
  {
    id: 'the-batman',
    title: 'The Batman',
    year: 2022,
    categoryId: 'action',
    rating: 7.8,
  },
  {
    id: 'parasite',
    title: 'Parasite',
    year: 2019,
    categoryId: 'thriller',
    rating: 8.5,
  },
  {
    id: 'whiplash',
    title: 'Whiplash',
    year: 2014,
    categoryId: 'drama',
    rating: 8.5,
  },
  {
    id: 'arrival',
    title: 'Arrival',
    year: 2016,
    categoryId: 'sci-fi',
    rating: 7.9,
  },
];

/** Cards rendered while the first page is still in flight. */
export const SKELETON_CARD_COUNT = 8;

export const DISCOVER_COPY = {
  title: 'Keşfet',
  subtitle: 'Popüler filmleri gez, listene ekle, puanla',
  categoriesLabel: 'Kategoriler',
  filtersLabel: 'Filtreler',
  viewLabel: 'Görünüm',
  results: (formattedCount: string) => `${formattedCount} sonuç`,
  showMore: (hiddenCount: number) => `+${hiddenCount}`,
  showMoreLabel: (hiddenCount: number) => `${hiddenCount} kategori daha göster`,
  showLess: 'Daha az',
  yearRange: (from: number, to: number) => `${from} – ${to}`,
  minRating: (value: number) => `${value}+ puan`,

  gridLabel: 'Filmler',
  add: 'Ekle',
  addLabel: (title: string) => `${title} filmini listene ekle`,
  watched: 'İzlendi',
  listed: 'Listede',
  loadMore: 'Daha fazla yükle',
  loading: 'Filmler yükleniyor',
  empty: 'Bu filtrelere uyan film bulunamadı',
  /**
   * Deliberately not `Intl.NumberFormat(DISCOVER_LOCALE)`: tr-TR would render
   * "8,4", and the reference badges read "8.4".
   */
  rating: (value: number) => value.toFixed(1),
  ratingLabel: (value: number) => `${value.toFixed(1)} / 10 puan`,
  movieMeta: (year: number, genreLabel?: string) =>
    genreLabel ? `${year} · ${genreLabel}` : `${year}`,
} as const;
