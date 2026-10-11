import { describe, expect, it } from "vitest"
import { loginPath, nextPathAfterLogin } from "./login-target"

describe("nextPathAfterLogin", () => {
  it("leads to the page that was asked for", () => {
    expect(nextPathAfterLogin("/tournaments/vertigo-s1/b2-esports?view=map")).toBe("/tournaments/vertigo-s1/b2-esports?view=map")
  })

  it("leads to the dashboard without a page", () => {
    expect(nextPathAfterLogin(null)).toBe("/dashboard")
    expect(nextPathAfterLogin("")).toBe("/dashboard")
  })

  it("never leads to another site", () => {
    expect(nextPathAfterLogin("https://evil.example/x")).toBe("/dashboard")
    expect(nextPathAfterLogin("//evil.example/x")).toBe("/dashboard")
    expect(nextPathAfterLogin("/\\evil.example")).toBe("/dashboard")
    expect(nextPathAfterLogin("javascript:alert(1)")).toBe("/dashboard")
  })

  it("does not lead back to the login or to an API address", () => {
    expect(nextPathAfterLogin("/login")).toBe("/dashboard")
    expect(nextPathAfterLogin("/login?next=/players")).toBe("/dashboard")
    expect(nextPathAfterLogin("/api/players")).toBe("/dashboard")
  })
})

describe("loginPath", () => {
  it("remembers the page someone was sent away from", () => {
    expect(loginPath("/players/felix", "")).toBe("/login?next=%2Fplayers%2Ffelix")
    expect(loginPath("/tournaments/vertigo-s1", "?view=map&stages=a,b")).toBe("/login?next=%2Ftournaments%2Fvertigo-s1%3Fview%3Dmap%26stages%3Da%2Cb")
  })

  it("is the plain login for the start page, the dashboard and API addresses", () => {
    expect(loginPath("/", "")).toBe("/login")
    expect(loginPath("/dashboard", "")).toBe("/login")
    expect(loginPath("/api/players", "")).toBe("/login")
  })

  it("round-trips through the login", () => {
    const target = new URL(loginPath("/players/felix", "?x=1"), "https://example.com").searchParams.get("next")
    expect(nextPathAfterLogin(target)).toBe("/players/felix?x=1")
  })
})
