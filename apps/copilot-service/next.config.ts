import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is run separately; skip during `next build` to avoid
    // circular-reference bug in eslint-config-next 16.x + FlatCompat
    ignoreDuringBuilds: true,
  },
  headers: async () => [
    {
      // AI trigger endpoints — never cache, always fresh
      source: "/api/copilot/v1/(analyze|suggest|draft-reply|chat|similar|feedback|update-status)",
      headers: [
        { key: "Cache-Control", value: "no-store" },
      ],
    },
    {
      // Job status polling — short TTL so in-flight jobs update quickly;
      // completed jobs are immutable but clients stop polling anyway
      source: "/api/copilot/v1/status/:id",
      headers: [
        { key: "Cache-Control", value: "no-store" },
      ],
    },
    {
      // KB ingest — mutating, never cache
      source: "/api/copilot/v1/kb/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store" },
      ],
    },
    {
      // Health + activity endpoints — allow short public caching
      source: "/api/copilot/v1/(health|activity)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=10, stale-while-revalidate=30" },
      ],
    },
  ],
};

export default nextConfig;
