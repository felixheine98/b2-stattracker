import { describe, expect, it } from "vitest"
import { compareMatch, type StoredMatch } from "./summary-compare"
import type { PlannedMatch } from "./summary-import"

const planned: PlannedMatch = {
  team: "B2 Rising", stage: { type: "GROUP", number: 1 }, number: 1, opponent: "Onyx", date: null,
  subMatches: [{
    order: 1, format: "ROUND_1V1", track: null, rounds: 2, roundsWon: 1, roundsLost: 1, outcome: "D", sourceUrl: "u", sourceImage: "1_0",
    players: [{ name: "Sebi", tmId: "tm-sebi", rounds: 2, placementSum: 3, points: null }],
  }],
}
const result = (tmId: string, isOurTeam: boolean) => ({ tmId, playerName: tmId, isOurTeam })

describe("compareMatch", () => {
  it("finds no difference when the rounds give what the screenshot says", () => {
    const stored: StoredMatch = { subMatches: [{ format: "ROUND_1V1", order: 0, summary: null, rounds: [{ results: [result("tm-sebi", true), result("opp", false)] }, { results: [result("opp", false), result("tm-sebi", true)] }] }] }
    const [sm] = compareMatch(planned, stored)
    expect(sm).toMatchObject({ kind: "rounds", resultDiffers: false, stored: { won: 1, lost: 1, outcome: "D" } })
    expect(sm.players).toEqual([{ tmId: "tm-sebi", name: "Sebi", file: { rounds: 2, placementSum: 3, points: null }, stored: { rounds: 2, placementSum: 3, points: null }, differs: false }])
  })

  it("marks a different result and players missing on either side", () => {
    const stored: StoredMatch = { subMatches: [{ format: "ROUND_1V1", order: 0, summary: null, rounds: [{ results: [result("tm-rain", true), result("opp", false)] }] }] }
    const [sm] = compareMatch(planned, stored)
    expect(sm).toMatchObject({ resultDiffers: true, stored: { won: 1, lost: 0, outcome: "W" } })
    expect(sm.players).toEqual([
      { tmId: "tm-sebi", name: "Sebi", file: { rounds: 2, placementSum: 3, points: null }, stored: null, differs: true },
      { tmId: "tm-rain", name: "tm-rain", file: null, stored: { rounds: 1, placementSum: 1, points: null }, differs: true },
    ])
  })

  it("compares with an imported summary and takes the sub-match of the same format", () => {
    const summary = { track: null, rounds: 2, roundsWon: 1, roundsLost: 1, outcome: "D" as const, players: [{ playerId: "p", tmId: "tm-sebi", playerName: "LPNSebi", rounds: 2, placementSum: 4 }] }
    const stored: StoredMatch = { subMatches: [{ format: "ROUND_2V2", order: 0, summary: null, rounds: [] }, { format: "ROUND_1V1", order: 1, summary, rounds: [] }] }
    const [sm] = compareMatch(planned, stored)
    expect(sm).toMatchObject({ kind: "summary", resultDiffers: false })
    expect(sm.players[0]).toMatchObject({ stored: { rounds: 2, placementSum: 4 }, differs: true })
  })

  it("compares the points of a sub-match given in points instead of places", () => {
    const file: PlannedMatch = { ...planned, subMatches: [{ ...planned.subMatches[0], players: [{ name: "Sebi", tmId: "tm-sebi", rounds: 2, placementSum: null, points: 7 }] }] }
    const summary = (points: number) => ({ track: null, rounds: 2, roundsWon: 1, roundsLost: 1, outcome: "D" as const, players: [{ playerId: "p", tmId: "tm-sebi", playerName: "LPNSebi", rounds: 2, placementSum: null, points }] })
    const stored = (points: number): StoredMatch => ({ subMatches: [{ format: "ROUND_1V1", order: 0, summary: summary(points), rounds: [] }] })

    expect(compareMatch(file, stored(7))[0].players).toEqual([{ tmId: "tm-sebi", name: "Sebi", file: { rounds: 2, placementSum: null, points: 7 }, stored: { rounds: 2, placementSum: null, points: 7 }, differs: false }])
    expect(compareMatch(file, stored(6))[0].players[0].differs).toBe(true)
  })

  it("says when the match has no such sub-match", () => {
    expect(compareMatch(planned, { subMatches: [] })[0]).toMatchObject({ kind: null, stored: null, resultDiffers: true })
    expect(compareMatch(planned, null)[0]).toMatchObject({ kind: null })
  })
})
