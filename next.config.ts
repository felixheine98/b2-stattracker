import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/b2-stats",
  allowedDevOrigins: ["reh-netsolutions.cc"],
}

export default nextConfig
