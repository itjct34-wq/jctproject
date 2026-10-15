/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Keep strict types in CI when possible; ignoreBuildErrors is a last resort
  // if partial selects still trip TS on Vercel.
  typescript: {
    ignoreBuildErrors: false,
  },
  // unoptimized: logos and mixed host photos (Supabase public URLs) stay reliable
  // without a remotePatterns rewrite. Do not flip this without verifying /brand and catalog images.
  images: { unoptimized: true },
};

module.exports = nextConfig;
