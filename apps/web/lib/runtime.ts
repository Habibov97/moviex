/**
 * `166` → `2h 46m` / `2 sa 46 dk` / `2 ч 46 мин`.
 *
 * Two messages rather than one, because a film under an hour must not render
 * "0h 46m" — English drops the hours part entirely, and so does every other
 * language. The arithmetic is shared; only the wording differs, so it lives in
 * the `detail` namespace as `runtimeShortHours` / `runtimeShortMinutes`.
 *
 * Takes the translator rather than calling one itself, so the same helper works
 * from a Server Component (`getTranslations`) and a client one
 * (`useTranslations`).
 */
export function runtimeShort(
  t: (key: string, values?: Record<string, string | number>) => string,
  totalMinutes: number,
): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0
    ? t('runtimeShortHours', { hours, minutes })
    : t('runtimeShortMinutes', { minutes });
}
