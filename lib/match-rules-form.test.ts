import { describe, expect, it } from "vitest"
import { draftOf, playoffBodyOf, playoffDraftOf, rulesBodyOf } from "./match-rules-form"

describe("rules draft", () => {
  const body = {
    flow: "DECIDER",
    formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null }, ROUND_2V2: { roundsToWin: 5, maxRounds: 13 } },
    points: { win: 3, draw: 1, loss: 0 },
  }

  it("turns stored rules into what the fields show and back", () => {
    const draft = draftOf(body)
    expect(draft.formatRules.ROUND_2V2).toEqual({ roundsToWin: "5", maxRounds: "13" })
    expect(draft.formatRules.ROUND_1V1.maxRounds).toBe("")
    expect(draft.points).toEqual({ win: "3", draw: "1", loss: "0" })
    expect(rulesBodyOf(draft)).toEqual(body)
  })

  it("starts with nothing filled in", () => {
    expect(rulesBodyOf(draftOf(null))).toEqual({ flow: null, formatRules: {}, points: { win: null, draw: null, loss: null } })
  })

  it("sends what is not a number as missing, and an empty round limit as none", () => {
    const draft = { ...draftOf(body), formatRules: { ROUND_1V1: { roundsToWin: "x", maxRounds: " " }, ROUND_2V2: { roundsToWin: " 7 ", maxRounds: "13" } } }
    expect(rulesBodyOf(draft).formatRules).toEqual({ ROUND_1V1: { roundsToWin: null, maxRounds: null }, ROUND_2V2: { roundsToWin: 7, maxRounds: 13 } })
  })

  it("sends the playoffs with their own sequence and without points", () => {
    expect(playoffBodyOf({ ...draftOf(body), formats: ["ROUND_1V1", "ROUND_2V2"] })).toEqual({ formats: ["ROUND_1V1", "ROUND_2V2"], flow: "DECIDER", formatRules: body.formatRules })
  })

  it("turns stored playoff rules into their fields and back, and none into none", () => {
    const playoff = { formats: ["ROUND_3V3", "ROUND_3V3"], flow: "ALL", formatRules: { ROUND_3V3: { roundsToWin: 5, maxRounds: null } } }
    expect(playoffBodyOf(playoffDraftOf(playoff)!)).toEqual(playoff)
    expect(playoffDraftOf(null)).toBeNull()
  })
})
