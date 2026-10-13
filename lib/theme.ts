// The colour theme of the interface. Dark is the default; the choice is kept in a cookie, so
// the server can already render the page in it (app/layout.tsx). The colours are in globals.css.

export type Theme = "dark" | "light" | "midnight" | "oled"
export type ThemeChoice = Theme | "system"

export const THEME_COOKIE = "theme"

export function themeFromCookie(value: string | undefined): ThemeChoice {
  return value === "light" || value === "midnight" || value === "oled" || value === "system" ? value : "dark"
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  return choice === "system" ? (prefersDark ? "dark" : "light") : choice
}

// The colour phones draw around the page (status bar, install splash)
export const THEME_COLOR: Record<Theme, string> = {
  dark: "#111214",
  light: "#f4f2ee",
  midnight: "#0b1224",
  oled: "#000000",
}
