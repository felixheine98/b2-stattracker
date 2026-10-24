import { describe, expect, it } from "vitest"
import { matchdayPlanningEnabled, matchRulesEnabled, summaryCompareEnabled, vodArchiveEnabled } from "./features"

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

describe("matchdayPlanningEnabled", () => {
  it("is on only when switched on", () => {
    expect(matchdayPlanningEnabled({ NODE_ENV: "development", MATCHDAY_PLANNING: "on" })).toBe(true)
    expect(matchdayPlanningEnabled({ NODE_ENV: "development", MATCHDAY_PLANNING: "off" })).toBe(false)
    expect(matchdayPlanningEnabled({ NODE_ENV: "development" })).toBe(false)
  })

  // Felix switched it on for production on 23.10.2026
  it("is on in production too when switched on there", () => {
    expect(matchdayPlanningEnabled({ NODE_ENV: "production", MATCHDAY_PLANNING: "on" })).toBe(true)
    expect(matchdayPlanningEnabled({ NODE_ENV: "production" })).toBe(false)
  })
})

describe("vodArchiveEnabled", () => {
  it("is on when backups run automatically or by hand", () => {
    expect(vodArchiveEnabled({ NODE_ENV: "production", VOD_ARCHIVE: "auto" })).toBe(true)
    expect(vodArchiveEnabled({ NODE_ENV: "development", VOD_ARCHIVE: "manual" })).toBe(true)
  })

  it("is off unless switched on", () => {
    expect(vodArchiveEnabled({ NODE_ENV: "production", VOD_ARCHIVE: "off" })).toBe(false)
    expect(vodArchiveEnabled({ NODE_ENV: "production", VOD_ARCHIVE: "on" })).toBe(false)
    expect(vodArchiveEnabled({ NODE_ENV: "production" })).toBe(false)
  })
})
