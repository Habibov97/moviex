/**
 * The catalogue contract the discover screens are built against.
 *
 * `apps/web` currently feeds these shapes from a static constants module, but
 * nothing in the UI reads a category label it owns — so when `apps/api` starts
 * serving categories only the data source changes, not the components.
 */

export type MovieCategory = {
  /**
   * Stable key the API returns. Selection state, query params and analytics all
   * key off this — never off `label`, which is display-only and translatable.
   */
  id: string;
  label: string;
};

/** Pseudo-category id meaning "no genre filter applied". */
export const ALL_CATEGORIES_ID = 'all';

/**
 * How the signed-in user has already engaged with a film. Absent (or `null`)
 * means neither — the card then shows no status tag.
 */
export type MovieUserState = 'watched' | 'listed';

/** A single catalogue entry as the discover grid renders it. */
export type Movie = {
  id: string;
  title: string;
  /** Release year. */
  year: number;
  /**
   * `MovieCategory.id` of the film's primary genre. The label is resolved from
   * the category list at render time — never stored on the movie, for the same
   * reason `MovieCategory.label` is display-only.
   */
  categoryId: string;
  /** 0–10; the UI renders it with a single decimal. */
  rating: number;
  /**
   * Absent until the catalogue serves artwork. While it is missing (or the
   * image is still loading) the card falls back to its skeleton tone.
   */
  posterUrl?: string | null;
  /** Only meaningful for a signed-in user; the API omits it otherwise. */
  userState?: MovieUserState | null;
};

export type MovieSortId = 'popularity' | 'rating' | 'release-date' | 'title';

/** Query shape the discover endpoint will accept. */
export type DiscoverFilters = {
  categoryId: string;
  yearFrom: number;
  yearTo: number;
  minRating: number;
  sort: MovieSortId;
};
