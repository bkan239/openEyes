import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consume the shared TS package directly from source — no build step needed.
  transpilePackages: ["@openeyes/shared"],
  reactStrictMode: true,
};

export default nextConfig;
