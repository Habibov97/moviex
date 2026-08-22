import { IsIn, IsOptional } from 'class-validator';
import type { Locale } from '@moviex/shared-types';

import { API_LOCALES, DEFAULT_LOCALE } from '../tmdb-language';

/**
 * The `lang` param every `/tmdb/*` endpoint accepts.
 *
 * Validated against `API_LOCALES`, which is derived from the TMDB language map
 * and type-checked against `Locale` in `@moviex/shared-types` — the same union
 * the web app builds its routes from. So a language the frontend can select is
 * by construction one this API knows, and anything else is a 400 here rather
 * than a confusing TMDB 503.
 *
 * The mapping to TMDB's own tag (`tr` → `tr-TR`) lives in `tmdb-language.ts`,
 * not here: the wire vocabulary and TMDB's vocabulary are deliberately
 * separate, exactly like `MovieSortId` and `sort_by`.
 */
export class LangQueryDto {
  @IsOptional()
  @IsIn(API_LOCALES as unknown as string[])
  lang?: Locale = DEFAULT_LOCALE;
}
