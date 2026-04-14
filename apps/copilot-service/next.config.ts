import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is run separately; skip during `next build` to avoid
    // circular-reference bug in eslint-config-next 16.x + FlatCompat
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
