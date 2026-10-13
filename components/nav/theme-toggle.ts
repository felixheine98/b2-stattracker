import { BASE_PATH } from "@/lib/base-path"
import { resolveTheme, THEME_COLOR, THEME_COOKIE, themeFromCookie, type ThemeChoice } from "@/lib/theme"

export const THEME_CHANGE_EVENT = "theme-choice-change"

export function currentThemeChoice() {
  return themeFromCookie(document.documentElement.dataset.themeChoice)
}

export function applyTheme(choice: ThemeChoice) {
  const next = resolveTheme(choice, window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.dataset.theme = next
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute("media")
    meta.setAttribute("content", THEME_COLOR[next])
  })
}

// Persist the preference, rather than the currently resolved system colour.
export function selectTheme(choice: ThemeChoice) {
  document.documentElement.dataset.themeChoice = choice
  applyTheme(choice)
  document.cookie = `${THEME_COOKIE}=${choice}; path=${BASE_PATH || "/"}; max-age=31536000; samesite=lax`
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}
