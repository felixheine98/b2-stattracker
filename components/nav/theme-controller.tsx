"use client"

import { useEffect } from "react"
import { applyTheme, currentThemeChoice } from "./theme-toggle"

// Also mounted on the login page, so system changes work across the whole app.
export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => applyTheme(currentThemeChoice())
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return null
}
