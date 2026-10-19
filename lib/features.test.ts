import { describe, expect, it } from "vitest"
import { matchRulesEnabled, summaryCompareEnabled } from "./features"

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

describe("summaryCompareEnabled", () => {
  it("is on only when switched on and the screenshot folder is given", () => {
    expect(summaryCompareEnabled({ NODE_ENV: "development", SUMMARY_COMPARE: "on", SUMMARY_SCREENSHOTS_DIR: "/screenshots" })).toBe(true)
    expect(summaryCompareEnabled({ NODE_ENV: "development", SUMMARY_COMPARE: "on" })).toBe(false)
    expect(summaryCompareEnabled({ NODE_ENV: "development", SUMMARY_SCREENSHOTS_DIR: "/screenshots" })).toBe(false)
  })

  it("is always off in production, even when switched on", () => {
    expect(summaryCompareEnabled({ NODE_ENV: "production", SUMMARY_COMPARE: "on", SUMMARY_SCREENSHOTS_DIR: "/screenshots" })).toBe(false)
  })
})
