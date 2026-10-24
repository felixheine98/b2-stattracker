import { describe, expect, it } from "vitest"
import { isPublicPath } from "./public-paths"

describe("pages reachable without signing in", () => {
  it("are the privacy policy and the sign-in itself, nothing else", () => {
    expect(isPublicPath("/privacy")).toBe(true)
    expect(isPublicPath("/api/auth/callback/credentials")).toBe(true)
    expect(isPublicPath("/api/passkey/options")).toBe(true)
    expect(isPublicPath("/privacy-settings")).toBe(false)
    expect(isPublicPath("/privacy/../tournaments")).toBe(false)
    expect(isPublicPath("/tournaments")).toBe(false)
    expect(isPublicPath("/api/youtube/callback")).toBe(false)
  })
  it("lets the bot reach only its exact token-protected feedback endpoint", () => {
    expect(isPublicPath("/api/internal/feedback")).toBe(true)
    expect(isPublicPath("/api/internal/feedback/anything")).toBe(false)
    expect(isPublicPath("/api/admin/feedback")).toBe(false)
  })
})
