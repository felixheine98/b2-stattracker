import { describe, expect, it } from "vitest"
import { matchRulesEnabled } from "./features"

describe("matchRulesEnabled", () => {
  it("is on only when switched on", () => {
    expect(matchRulesEnabled({ NODE_ENV: "development", MATCH_RULES: "on" })).toBe(true)
    expect(matchRulesEnabled({ NODE_ENV: "development", MATCH_RULES: "off" })).toBe(false)
    expect(matchRulesEnabled({ NODE_ENV: "development" })).toBe(false)
  })

  it("is always off in production, even when switched on", () => {
    expect(matchRulesEnabled({ NODE_ENV: "production", MATCH_RULES: "on" })).toBe(false)
  })
})
