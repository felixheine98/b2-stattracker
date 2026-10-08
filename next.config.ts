import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/b2-stats",
  allowedDevOrigins: ["reh-netsolutions.cc"],
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
