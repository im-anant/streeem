import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@streamsync/shared"],
  typescript: {
    // ignoreBuildErrors: true, // impactful change: re-enabling type checks
  },
  experimental: {
    // keep defaults; placeholder for future streaming/suspense tuning
  }
};

export default nextConfig;

