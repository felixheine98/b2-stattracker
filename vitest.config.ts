import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // The same "@/..." imports as in the app (tsconfig.json), so routes can be tested too
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "") } },
  test: { exclude: ["node_modules/**", ".next/**", ".claude/**"] },
})
