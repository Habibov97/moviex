/**
 * Copy for thrown-error boundaries (`error.tsx`).
 *
 * Separate from `DISCOVER_COPY.empty` on purpose: that one means "the request
 * succeeded and matched nothing", which is a statement about the catalogue.
 * These mean "we could not reach the server at all". Conflating them would tell
 * a user their filter is too narrow when the API is simply down.
 */
export const ERROR_COPY = {
  discoverTitle: "Couldn't load movies",
  searchTitle: "Couldn't load search results",
  movieTitle: "Couldn't load this movie",
  body: 'Something went wrong while reaching our servers. Check your connection and try again.',
  tryAgain: 'Try again',
} as const;

/** Account-control copy. Kept beside the error copy: both are app-wide chrome. */
export const AUTH_COPY = {
  signInOrCreate: 'Sign in or create an account',
  logOut: 'Log out',
  loggingOut: 'Logging out…',

  // Curated submit-failure copy. The backend's own wording is only surfaced
  // where it is already user-appropriate (its 400 field messages).
  invalidCredentials: 'Invalid email or password',
  emailTaken: 'That email is already registered — sign in instead',
  networkError: "Couldn't reach our servers. Check your connection and try again.",
  genericError: 'Something went wrong, please try again',

  // Register does not sign the user in; this shows when the follow-up login
  // could not be completed automatically.
  accountCreated: 'Account created — sign in below',

  signingIn: 'Signing in…',
  creatingAccount: 'Creating account…',
} as const;
