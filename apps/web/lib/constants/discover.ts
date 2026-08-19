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
    runtimeMinutes: 166,
    overview:
      'Paul Atreides, çölün xalqı ilə birləşərək ailəsini məhv edənlərdən intiqam almaq yoluna çıxır.',
  },
  {
    id: 'oppenheimer',
    title: 'Oppenheimer',
    year: 2023,
    categoryId: 'drama',
    rating: 8.1,
    userState: 'watched',
    runtimeMinutes: 180,
    overview:
      'Atom bombasını yaradan fizikin həyatı və bu kəşfin onun vicdanında qoyduğu iz.',
  },
  {
    id: 'blade-runner-2049',
    title: 'Blade Runner 2049',
    year: 2017,
    categoryId: 'sci-fi',
    rating: 8.0,
    runtimeMinutes: 164,
    overview:
      'Gənc bir blade runner uzun müddət gizlədilmiş bir sirri üzə çıxarır və itkin düşmüş bir adamı axtarmağa başlayır.',
  },
  {
    id: 'interstellar',
    title: 'Interstellar',
    year: 2014,
    categoryId: 'sci-fi',
    rating: 8.6,
    userState: 'listed',
    runtimeMinutes: 169,
    overview:
      'Ölməkdə olan Yer üzünü tərk edən bir qrup astronavt insanlığa yeni ev axtarır.',
  },
  {
    id: 'the-batman',
    title: 'The Batman',
    year: 2022,
    categoryId: 'action',
    rating: 7.8,
    runtimeMinutes: 176,
    overview:
      'Gotham şəhərinin kölgələrində iz buraxan bir qatil Batman-i şəhərin ən dərin sirlərinə aparır.',
  },
  {
    id: 'parasite',
    title: 'Parasite',
    year: 2019,
    categoryId: 'thriller',
    rating: 8.5,
    runtimeMinutes: 132,
    overview:
      'Kasıb bir ailə varlı bir evə addım-addım sızır, lakin işlər gözlənilməz istiqamətə dönür.',
  },
  {
    id: 'whiplash',
    title: 'Whiplash',
    year: 2014,
    categoryId: 'drama',
    rating: 8.5,
    runtimeMinutes: 106,
    overview:
      'Gənc bir cazz barabançısı mükəmməlliyi tələb edən amansız bir müəllimin gözü altında sınağa çəkilir.',
  },
  {
    id: 'arrival',
    title: 'Arrival',
    year: 2016,
    categoryId: 'sci-fi',
    rating: 7.9,
    runtimeMinutes: 116,
    overview:
      'Bir dilçi Yerə gələn naməlum gəmilərlə ünsiyyət qurmağa çalışarkən zamanın özünü yenidən kəşf edir.',
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
  listLabel: 'Filmler listesi',
  add: 'Ekle',
  addLabel: (title: string) => `${title} filmini listene ekle`,
  /** Offered on a film already in the list but not yet watched. */
  markWatched: 'İzledim',
  markWatchedLabel: (title: string) => `${title} filmini izlendi olarak işaretle`,
  watched: 'İzlendi',
  listed: 'Listede',
  /** Two digits, so the numbers stay in one column down the list. */
  rank: (position: number) => String(position).padStart(2, '0'),
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
  /**
   * `166 → "2s 46d"`. The minutes part is kept even at zero (`180 → "3s 0d"`),
   * which is what the reference shows; under an hour the hours part is dropped.
   */
  runtime: (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}s ${rest}d` : `${rest}d`;
  },
  /** Same line as `movieMeta`, plus runtime when the catalogue has it. */
  movieMetaLong: (year: number, genreLabel?: string, runtime?: string) =>
    [year, genreLabel, runtime].filter(Boolean).join(' · '),
} as const;
