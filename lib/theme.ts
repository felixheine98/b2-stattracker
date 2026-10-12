// The colour theme of the interface. Dark is the default; the choice is kept in a cookie, so
// the server can already render the page in it (app/layout.tsx). The colours are in globals.css.

export type Theme = "dark" | "light"

export const THEME_COOKIE = "theme"

export function themeFromCookie(value: string | undefined): Theme {
  return value === "light" ? "light" : "dark"
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark"
}

// The colour phones draw around the page (status bar, install splash)
export const THEME_COLOR: Record<Theme, string> = {
  dark: "#111214",
  light: "#f4f2ee",
}
