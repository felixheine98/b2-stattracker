import { BASE_PATH } from "@/lib/base-path"
import type { MetadataRoute } from "next"

// Paths are written with the basePath because manifest URLs are not prefixed automatically
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B2 Stats",
    short_name: "B2 Stats",
    description: "Track your Trackmania team's tournament performance",
    start_url: `${BASE_PATH}/dashboard`,
    display: "standalone",
    theme_color: "#111214",
    background_color: "#0C0B0A",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${BASE_PATH}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
