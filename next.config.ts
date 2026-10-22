import type { NextConfig } from "next";

// `output: 'export'` makes `next dev` 500 on any id that was not returned from
// generateStaticParams. Ids are created in the browser, so the dev server
// stays dynamic and only `next build` writes the static site.
const isDevServer = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(isDevServer ? {} : { output: "export" as const }),
  // Static hosts have no image optimizer. The UI uses `<img>` and `<video>`.
  images: {
    unoptimized: true,
  },
  // Next 16 turns this on by default. In dev it waits on a debug stream that
  // never closes here, so the page stays server HTML and clicks do nothing.
  experimental: {
    reactDebugChannel: false,
  },
};

export default nextConfig;
