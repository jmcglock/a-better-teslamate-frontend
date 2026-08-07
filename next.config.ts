import type { NextConfig } from "next";

/**
 * View Transitions are supported at runtime in Next 16, but ExperimentalConfig
 * types in some installs omit `viewTransition` and fail Docker `tsc` checks.
 * Cast keeps the experiment without blocking the image build.
 */
const nextConfig = {
  output: "standalone",
  experimental: {
    viewTransition: true,
  },
} as NextConfig;

export default nextConfig;
