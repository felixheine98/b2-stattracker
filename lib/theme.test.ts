import { describe, expect, it } from "vitest"
import { resolveTheme, themeFromCookie } from "./theme"

describe("themeFromCookie", () => {
  it.each(["midnight", "oled", "system"])("remembers the %s choice", (choice) => {
    expect(themeFromCookie(choice)).toBe(choice)
  })
  it("is the light theme only when it was chosen", () => {
    expect(themeFromCookie("light")).toBe("light")
  })

  it("is the dark theme by default and for anything unknown", () => {
    expect(themeFromCookie(undefined)).toBe("dark")
    expect(themeFromCookie("dark")).toBe("dark")
    expect(themeFromCookie("pink")).toBe("dark")
    expect(themeFromCookie("")).toBe("dark")
  })
})

describe("resolveTheme", () => {
  it("follows the device only for the system choice", () => {
    expect(resolveTheme("system", true)).toBe("dark")
    expect(resolveTheme("system", false)).toBe("light")
    expect(resolveTheme("midnight", false)).toBe("midnight")
    expect(resolveTheme("oled", false)).toBe("oled")
    expect(resolveTheme("dark", false)).toBe("dark")
    expect(resolveTheme("light", true)).toBe("light")
  })
})
