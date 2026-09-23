import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the isolated browser test server separate from an existing dev session.
  distDir: process.env.KEYNOTE_TEST_DIST_DIR || ".next",
};

export default nextConfig;
