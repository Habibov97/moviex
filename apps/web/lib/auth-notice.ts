/**
 * The one-shot flag behind "you were sent here because you are signed out".
 *
 * `/my-list` bounces a confirmed signed-out visitor to Discover, and Discover
 * has to know to explain why — but only for that one arrival. Hence a flag that
 * is **consumed**: read and deleted in the same call, so a refresh, a bookmark
 * or a later normal visit to Discover shows nothing.
 *
 * **`sessionStorage`, not a query param.** A param would sit in the URL, be
 * copied into anything the user shares, and need a second `router.replace` to
 * clear — which is history churn to undo something the app itself put there.
 * The redirect is a client-side navigation, so `sessionStorage` survives it
 * intact, and it is per-tab, which matches a flag about one navigation.
 *
 * Every access is wrapped: `sessionStorage` throws outright in some privacy
 * modes, and a missing explanation is a cosmetic loss, never worth a crash.
 */
const AUTH_NOTICE_KEY = "moviex:auth-notice";

/** Called just before redirecting away from a page that needs a session. */
export function requestAuthNotice(): void {
  try {
    window.sessionStorage.setItem(AUTH_NOTICE_KEY, "1");
  } catch {
    // Storage unavailable — the redirect still happens, just unexplained.
  }
}

/**
 * Reads the flag **and clears it**, so it can only ever fire once.
 *
 * Clearing on read rather than on dismiss is deliberate: it makes a double
 * invocation (React's development double-effect, say) harmless, because the
 * second call already sees nothing.
 */
export function consumeAuthNotice(): boolean {
  try {
    if (window.sessionStorage.getItem(AUTH_NOTICE_KEY) === null) return false;

    window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
    return true;
  } catch {
    return false;
  }
}
