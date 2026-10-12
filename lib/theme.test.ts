import { describe, expect, it } from "vitest"
import { otherTheme, themeFromCookie } from "./theme"

describe("themeFromCookie", () => {
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

describe("otherTheme", () => {
  it("switches between the two", () => {
    expect(otherTheme("dark")).toBe("light")
    expect(otherTheme("light")).toBe("dark")
  })
})
