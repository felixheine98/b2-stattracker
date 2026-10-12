import { BASE_PATH } from "@/lib/base-path"
import { otherTheme, THEME_COLOR, THEME_COOKIE, themeFromCookie } from "@/lib/theme"

// Switches to the other theme: applied at once, and kept in a cookie for the next page load
// (app/layout.tsx reads it). What the switch shows follows from the page itself (the `light:`
// variant in globals.css), so it is right from the first paint.
export function toggleTheme() {
  const next = otherTheme(themeFromCookie(document.documentElement.dataset.theme))
  document.documentElement.dataset.theme = next
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next])
  document.cookie = `${THEME_COOKIE}=${next}; path=${BASE_PATH || "/"}; max-age=31536000; samesite=lax`
}
