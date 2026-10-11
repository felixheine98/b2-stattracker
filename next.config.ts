import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

// Where the app is served, e.g. "/stats" for example.com/stats. Read by the code as BASE_PATH (lib/base-path.ts).
const basePath = process.env.BASE_PATH || "/b2-stats"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // The site is served to everyone from the dev server; its indicator (a logo that flashes in a
  // corner on every data refresh) has no place there. Errors are still shown.
  devIndicators: false,
  allowedDevOrigins: ["reh-netsolutions.cc", "b2-esports.com", "www.b2-esports.com"],
  // The site sits behind Cloudflare, which turns the dev server's "no-cache" into a
  // 4 hour browser cache for scripts. no-store keeps browsers from running stale dev code.
  ...(isDev && {
    async headers() {
      return [
        {
          source: "/_next/static/:path*",
          headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
        },
      ]
    },
  }),
}

export default nextConfig
