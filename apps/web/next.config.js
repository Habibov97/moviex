/** @type {import('next').NextConfig} */
const nextConfig = {
  // `@moviex/shared-types` ships raw TS source (see its package.json `exports`),
  // so Next has to compile it alongside the app.
  transpilePackages: ["@moviex/shared-types"],
};

export default nextConfig;
