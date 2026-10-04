import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 turns this on by default. In dev it waits on a debug stream that
  // never closes here, so the page stays server HTML and clicks do nothing.
  experimental: {
    reactDebugChannel: false,
  },
};

export default nextConfig;
