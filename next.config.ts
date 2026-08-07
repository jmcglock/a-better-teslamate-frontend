import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Soft fade between App Router navigations (CSS in globals.css).
    viewTransition: true,
  },
};

export default nextConfig;
