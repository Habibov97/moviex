import { registerAs } from '@nestjs/config';

export default registerAs('tmdb', () => ({
  apiKey: process.env.TMDB_API_KEY,
  /** Injected rather than inlined so tests can point at a stub server. */
  baseUrl: process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3',
}));
