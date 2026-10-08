import type { MetadataRoute } from "next"

// Paths are written with the basePath because manifest URLs are not prefixed automatically
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B2 Stats",
    short_name: "B2 Stats",
    description: "Track your Trackmania team's tournament performance",
    start_url: "/b2-stats/dashboard",
    display: "standalone",
    theme_color: "#111214",
    background_color: "#0C0B0A",
    icons: [
      { src: "/b2-stats/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/b2-stats/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/b2-stats/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
