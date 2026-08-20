/** @type {import('next').NextConfig} */
const nextConfig = {
  // `@moviex/shared-types` ships raw TS source (see its package.json `exports`),
  // so Next has to compile it alongside the app.
  transpilePackages: ["@moviex/shared-types"],
  images: {
    // Posters are absolute TMDB URLs built in `TmdbService.toMovieSummary`;
    // next/image refuses any remote host not listed here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
