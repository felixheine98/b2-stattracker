import { describe, expect, it } from "vitest"
import { SEEDING_TYPES } from "./seeding"
import { seedingStats } from "./seeding-stats"

const emc = SEEDING_TYPES.EMC.defaults
const runs = (entries: Array<[string | null, number | null]>) => entries.map(([playerId, score]) => ({ playerId, score }))

// B2 Academy in the S7 seeding: map 1 crypii 463, P3kingente 382, Siri 298, hyperxrage 315; map 2 four more
const academy = {
  lineupId: "academy",
  place: 19,
  league: "League 4 · Group H",
  runs: runs([["p3k", 382], ["siri", 298], ["crypii", 463], ["hyper", 315], ["benny", 380], ["parzival", 386], ["surv", 276], ["s0nity", 196]]),
}
// Another lineup still being recorded: crypii drove for it as well, one run without a score yet
const esports = {
  lineupId: "esports",
  place: null,
  league: null,
  runs: runs([["crypii", 500], ["toast", null], [null, null], [null, null], [null, null], [null, null], [null, null], [null, null]]),
}

describe("seeding stats", () => {
  const stats = seedingStats(emc, [esports, academy])

  it("list every lineup with its team total, place and league, the placed ones first", () => {
    expect(stats.lineups).toEqual([
      { lineupId: "academy", total: 2202, place: 19, league: "League 4 · Group H" },
      { lineupId: "esports", total: 500, place: null, league: null },
    ])
  })

  it("give every player their runs, average and best score, and how many runs counted for the team", () => {
    const of = (id: string) => stats.players.find((p) => p.playerId === id)
    // Over both lineups; each of crypii's runs is among the best 3 of its map
    expect(of("crypii")).toEqual({ playerId: "crypii", runs: 2, scored: 2, average: 481.5, best: 500, counted: 2 })
    // The fourth best on map 1 does not count
    expect(of("siri")).toEqual({ playerId: "siri", runs: 1, scored: 1, average: 298, best: 298, counted: 0 })
    // A run without a score counts as driven, but not into the average
    expect(of("toast")).toEqual({ playerId: "toast", runs: 1, scored: 0, average: null, best: null, counted: 0 })
  })

  it("put the best average first", () => {
    expect(stats.players.slice(0, 2).map((p) => p.playerId)).toEqual(["crypii", "parzival"])
    expect(stats.players.at(-1)!.playerId).toBe("toast")
  })
})
