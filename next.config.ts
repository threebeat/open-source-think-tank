import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Playwright and local network checks against 127.0.0.1 during development.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
