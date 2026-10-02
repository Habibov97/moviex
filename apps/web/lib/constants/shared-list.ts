/**
 * The public shared-list route, `/shared/<token>` (under `[locale]`).
 *
 * Contextual — reachable only from a link someone sent — so it is deliberately
 * **not** in `NAV_LINKS`.
 */
export const SHARED_LIST_BASE_PATH = "/shared";

/** Locale-free href for a token, for `Link` / `router` from `@/i18n/navigation`. */
export const sharedListHref = (token: string) =>
  `${SHARED_LIST_BASE_PATH}/${token}`;
