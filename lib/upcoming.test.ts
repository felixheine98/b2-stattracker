import { describe, expect, it } from "vitest"
import { isPlanned, upcomingMatches } from "./upcoming"

const round = { results: [] }
const summary = { rounds: 11, roundsWon: 7, roundsLost: 4, outcome: "W" }

describe("isPlanned", () => {
  it("is a match without sub-matches", () => {
    expect(isPlanned({ subMatches: [] })).toBe(true)
  })

  it("is a match whose sub-matches have neither rounds nor a summary yet", () => {
    expect(isPlanned({ subMatches: [{ rounds: [] }, { rounds: [], summary: null }] })).toBe(true)
  })

  it("is no longer once a sub-match has a round", () => {
    expect(isPlanned({ subMatches: [{ rounds: [] }, { rounds: [round] }] })).toBe(false)
  })

  it("is no longer once a sub-match has a summary", () => {
    expect(isPlanned({ subMatches: [{ rounds: [], summary }] })).toBe(false)
  })

  it("is no longer once the match is closed, even without rounds", () => {
    expect(isPlanned({ subMatches: [], closedAt: "2026-10-20T20:00:00Z" })).toBe(false)
  })
})

type Stage = { type: "SEEDING" | "GROUP" | "PLAYOFF"; number: number }
const day = (n: number): Stage => ({ type: "GROUP", number: n })
const match = (id: string, extra: Partial<{ stage: Stage; date: string | null; number: number | null; closedAt: string; subMatches: Array<{ rounds: unknown[] }> }> = {}) => ({
  id, stage: day(1), date: null, number: null, subMatches: [], ...extra,
})

describe("upcomingMatches", () => {
  it("keeps the planned matches and leaves out played ones and the seeding", () => {
    const matches = [
      match("played", { subMatches: [{ rounds: [round] }] }),
      match("closed", { closedAt: "2026-10-20T20:00:00Z" }),
      match("seeding", { stage: { type: "SEEDING", number: 1 } }),
      match("planned"),
    ]
    expect(upcomingMatches(matches).map((m) => m.id)).toEqual(["planned"])
  })

  it("lists them by date, then the ones without a date in playing order", () => {
    const matches = [
      match("undated-playoff", { stage: { type: "PLAYOFF", number: 1 } }),
      match("undated-day2-#4", { stage: day(2), number: 4 }),
      match("late", { stage: day(1), date: "2026-10-29T19:00:00Z" }),
      match("undated-day2-#3", { stage: day(2), number: 3 }),
      match("early", { stage: day(2), date: "2026-10-22T19:00:00Z" }),
    ]
    expect(upcomingMatches(matches).map((m) => m.id)).toEqual(["early", "late", "undated-day2-#3", "undated-day2-#4", "undated-playoff"])
  })
})
