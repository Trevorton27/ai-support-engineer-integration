import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/shared-types'],
  eslint: {
    // ESLint is run separately; skip during `next build` to avoid
    // circular-reference bug in eslint-config-next 16.x + FlatCompat
    ignoreDuringBuilds: true,
  },
  headers: async () => [
    {
      // Mutating endpoints — never cache
      source: "/api/tickets/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store" },
      ],
    },
  ],
};

export default nextConfig;
