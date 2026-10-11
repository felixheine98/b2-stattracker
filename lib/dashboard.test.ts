import { describe, expect, it } from "vitest"
import { bestPerformer, dashboardTournaments, latestStageId, lineupRecords, overallRecord, type DashMatch } from "./dashboard"

let nextId = 0

// A round given as the finishing order "name:seconds"; names starting with "opp" are the
// opponents, a "!" instead of the seconds marks a DNF
function round(...order: string[]) {
  return {
    track: "A",
    results: order.map((entry) => {
      const [name, time] = entry.split(":")
      const dnf = time === "!"
      return { id: `r${nextId++}`, tmId: name, playerName: name, playerId: name, isOurTeam: !name.startsWith("opp"), dnf, timeMs: dnf ? null : Number(time) * 1000 }
    }),
  }
}

const won = () => round("anna:60", "opp1:61")
const lost = () => round("opp1:60", "anna:61")

function match(rounds: ReturnType<typeof round>[][], extra: Partial<DashMatch> = {}): DashMatch {
  return {
    id: `m${nextId++}`,
    tournamentLineupId: "alpha",
    stage: { id: "md1", type: "GROUP" },
    opponent: "Onyx",
    date: null,
    createdAt: "2026-06-01T00:00:00Z",
    subMatches: rounds.map((r) => ({ format: "ROUND_1V1" as const, rounds: r })),
    ...extra,
  }
}

describe("dashboardTournaments", () => {
  const t = (id: string, startDate: string | null, endDate: string | null, lineups = 1) => ({ id, startDate, endDate, createdAt: "2026-01-01", lineupCount: lineups })

  it("counts a tournament with lineups as current while today lies within its dates", () => {
    const { current, last } = dashboardTournaments([t("old", "2026-06-07", "2026-06-28"), t("now", "2026-09-20", "2026-10-11")], "2026-10-11")
    expect(current.map((x) => x.id)).toEqual(["now"])
    expect(last?.id).toBe("old")
  })

  it("counts a started tournament without an end date as current", () => {
    expect(dashboardTournaments([t("open", "2026-09-20", null)], "2026-12-01").current.map((x) => x.id)).toEqual(["open"])
  })

  it("leaves out tournaments that are still being planned or have not started", () => {
    const { current, last } = dashboardTournaments([t("planned", "2026-10-01", "2026-11-01", 0), t("future", "2026-11-01", "2026-12-01")], "2026-10-11")
    expect(current).toEqual([])
    expect(last).toBeNull()
  })

  it("takes the tournament that ended most recently as the last one", () => {
    const { last } = dashboardTournaments([t("a", "2026-01-01", "2026-02-01"), t("b", "2026-06-07", "2026-06-28"), t("c", "2026-03-01", "2026-04-01")], "2026-10-11")
    expect(last?.id).toBe("b")
  })

  it("lists several current tournaments, the one that started last first", () => {
    const { current } = dashboardTournaments([t("a", "2026-09-01", "2026-11-01"), t("b", "2026-10-01", "2026-11-01")], "2026-10-11")
    expect(current.map((x) => x.id)).toEqual(["b", "a"])
  })
})

describe("lineupRecords", () => {
  it("sums up matches, maps and rounds per lineup", () => {
    const [alpha, bravo] = lineupRecords([
      match([[won(), won(), lost()], [lost()]]), // maps 1–1, a draw
      match([[won()], [won()]]), // won
      match([[lost()]], { tournamentLineupId: "bravo" }),
    ], ["alpha", "bravo"])
    expect(alpha).toMatchObject({ lineupId: "alpha", matchesWon: 1, matchesDrawn: 1, matchesLost: 0, mapsWon: 3, mapsLost: 1, roundsWon: 4, roundsLost: 2 })
    expect(bravo).toMatchObject({ matchesWon: 0, matchesLost: 1, mapsLost: 1, roundsLost: 1 })
  })

  it("takes the confirmed outcome of a closed match over the one worked out", () => {
    const [alpha] = lineupRecords([match([[lost()]], { closedAt: "2026-06-20", confirmedOutcome: "W" })], ["alpha"])
    expect(alpha).toMatchObject({ matchesWon: 1, matchesLost: 0 })
    expect(alpha.lastMatch).toMatchObject({ outcome: "W", confirmed: true })
  })

  it("names the match played last, with its score in maps", () => {
    const early = match([[won()]], { date: "2026-06-14", opponent: "Early" })
    const late = match([[lost()], [lost()]], { date: "2026-06-21", opponent: "Late" })
    const [alpha] = lineupRecords([late, early], ["alpha"])
    expect(alpha.lastMatch).toMatchObject({ id: late.id, opponent: "Late", outcome: "L", confirmed: false, mapsWon: 0, mapsLost: 2 })
  })

  it("leaves seeding and matches without results out", () => {
    const [alpha] = lineupRecords([
      match([[won()]], { stage: { id: "seed", type: "SEEDING" } }),
      match([[]]),
    ], ["alpha"])
    expect(alpha).toMatchObject({ matchesWon: 0, matchesDrawn: 0, matchesLost: 0, roundsWon: 0, lastMatch: null })
  })

  it("lists a lineup without matches with an empty record", () => {
    expect(lineupRecords([], ["alpha"])).toMatchObject([{ lineupId: "alpha", matchesWon: 0, lastMatch: null }])
  })
})

describe("overallRecord", () => {
  it("sums up all lineups", () => {
    const record = overallRecord([match([[won(), won()]]), match([[lost()]], { tournamentLineupId: "bravo" }), match([[won(), lost()]])])
    expect(record).toMatchObject({ matchesWon: 1, matchesDrawn: 1, matchesLost: 1, roundsWon: 3, roundsLost: 2 })
  })
})

describe("bestPerformer", () => {
  it("is the player with the best average placement", () => {
    const best = bestPerformer([match([[round("anna:50", "opp1:51", "ben:52", "opp2:60"), round("opp1:50", "ben:51", "anna:53", "opp2:60")]])])
    // anna 1st and 3rd, ben 3rd and 2nd
    expect(best).toMatchObject({ tmId: "anna", name: "anna", rounds: 2, lineupId: "alpha" })
    expect(best!.avgPlace).toBe(2)
  })

  it("compares placements by the size of the field, so formats can be mixed", () => {
    const best = bestPerformer([
      // ben: 2nd of 2, twice
      match([[round("opp1:50", "ben:51"), round("opp1:50", "ben:51")]]),
      // anna: 2nd and 3rd of 8, a better result although the plain average is worse
      match([[round("opp1:50", "anna:51", "opp3:52", "opp4:53", "opp5:54", "opp6:55", "opp7:56", "opp8:57"), round("opp1:50", "opp2:51", "anna:52", "opp4:53", "opp5:54", "opp6:55", "opp7:56", "opp8:57")]]),
    ])
    expect(best?.tmId).toBe("anna")
    expect(best!.avgPlace).toBe(2.5)
  })

  it("counts a round that was not finished as the last place, and leaves seeding out", () => {
    const best = bestPerformer([
      match([[round("opp1:50", "anna:51", "opp2:52", "ben:!")]]),
      match([[round("ben:40")]], { stage: { id: "seed", type: "SEEDING" } }),
    ])
    expect(best).toMatchObject({ tmId: "anna", avgPlace: 2, rounds: 1 })
  })

  it("is nobody without a round", () => {
    expect(bestPerformer([match([[]])])).toBeNull()
  })
})

describe("latestStageId", () => {
  it("is the last stage in playing order that has results", () => {
    const matches = [match([[won()]]), match([[won()]], { stage: { id: "md2", type: "GROUP" } }), match([[]], { stage: { id: "po", type: "PLAYOFF" } })]
    expect(latestStageId(matches, ["md1", "md2", "po"])).toBe("md2")
  })

  it("is null without results", () => {
    expect(latestStageId([], ["md1"])).toBeNull()
  })
})
