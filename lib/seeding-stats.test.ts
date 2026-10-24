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

  it("give every player of a lineup their score on each map and whether it counted for the team", () => {
    const of = (playerId: string, lineupId: string) => stats.players.find((p) => p.playerId === playerId && p.lineupId === lineupId)
    expect(of("crypii", "academy")).toEqual({ playerId: "crypii", lineupId: "academy", maps: [{ score: 463, counted: true }, null] })
    // The fourth best on map 1 does not count
    expect(of("siri", "academy")!.maps).toEqual([{ score: 298, counted: false }, null])
    // Driven for another lineup as well: a row of its own
    expect(of("crypii", "esports")!.maps).toEqual([{ score: 500, counted: true }, null])
    // A run without a score yet
    expect(of("toast", "esports")!.maps).toEqual([{ score: null, counted: false }, null])
  })

  it("put the best score first", () => {
    expect(stats.players.slice(0, 3).map((p) => [p.playerId, p.lineupId])).toEqual([["crypii", "esports"], ["crypii", "academy"], ["parzival", "academy"]])
    expect(stats.players.at(-1)!.playerId).toBe("toast")
  })
})
