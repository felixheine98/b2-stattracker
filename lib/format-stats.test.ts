import { describe, expect, it } from "vitest"
import { buildAggregates, matchesOfLineups, matchesOfStages, type StatsMatch } from "./format-stats"

let nextId = 0

// A round given as the finishing order; names starting with "opp" are the opponents, a trailing "!" marks a DNF
function round(...order: string[]) {
  return {
    results: order.map((entry) => {
      const name = entry.replace("!", "")
      return { id: `r${nextId++}`, tmId: name, playerName: name, isOurTeam: !name.startsWith("opp"), dnf: entry.endsWith("!") }
    }),
  }
}

function match(rounds: ReturnType<typeof round>[], extra: Partial<StatsMatch> = {}): StatsMatch {
  return { id: `m${nextId++}`, stage: { id: "md1", type: "GROUP" }, subMatches: [{ format: "ROUND_2V2", rounds }], ...extra }
}

describe("buildAggregates", () => {
  it("counts won and lost rounds only for the players who took part in them", () => {
    const [agg] = buildAggregates([
      match([
        round("anna", "ben", "opp1", "opp2"), // won
        round("opp1", "opp2", "anna", "cleo"), // lost
      ]),
    ])

    expect(agg.players.get("anna")).toMatchObject({ roundsWon: 1, roundsLost: 1 })
    expect(agg.players.get("ben")).toMatchObject({ roundsWon: 1, roundsLost: 0 })
    expect(agg.players.get("cleo")).toMatchObject({ roundsWon: 0, roundsLost: 1 })
    expect(agg).toMatchObject({ teamRoundsWon: 1, teamRoundsLost: 1 })
  })

  it("sums up the placements of a player over all rounds played", () => {
    const [agg] = buildAggregates([
      match([round("anna", "ben", "opp1", "opp2"), round("opp1", "opp2", "anna", "cleo")]),
    ])

    expect(agg.players.get("anna")).toMatchObject({ roundsPlayed: 2, placementSum: 4 })
    expect(agg.players.get("cleo")).toMatchObject({ roundsPlayed: 1, placementSum: 4 })
  })

  it("counts a round with equal points as neither won nor lost", () => {
    const [agg] = buildAggregates([match([round("anna", "opp1", "opp2", "ben")])])

    expect(agg.players.get("anna")).toMatchObject({ roundsPlayed: 1, roundsWon: 0, roundsLost: 0 })
    expect(agg).toMatchObject({ teamRoundsWon: 0, teamRoundsLost: 0 })
  })

  it("counts a round as won when an opponent's DNF breaks the tie", () => {
    const [agg] = buildAggregates([match([round("anna", "opp1", "opp2", "ben"), round("opp1", "anna", "ben", "opp2!")])])

    expect(agg.players.get("anna")).toMatchObject({ roundsPlayed: 2, roundsWon: 1, roundsLost: 0 })
    expect(agg).toMatchObject({ teamRoundsWon: 1, teamRoundsLost: 0 })
  })

  it("counts a DNF as last place and keeps count of them", () => {
    const [agg] = buildAggregates([match([round("anna", "opp1", "ben!", "opp2!"), round("ben", "anna", "opp1", "opp2")])])

    expect(agg.players.get("ben")).toMatchObject({ roundsPlayed: 2, placementSum: 5, dnfs: 1 })
    expect(agg.players.get("anna")).toMatchObject({ roundsPlayed: 2, placementSum: 3, dnfs: 0 })
  })

  it("leaves seeding matches out", () => {
    const aggregates = buildAggregates([
      match([round("anna", "ben", "opp1", "opp2")]),
      match([round("opp1", "opp2", "anna", "ben")], { stage: { id: "seeding", type: "SEEDING" } }),
    ])

    expect(aggregates).toHaveLength(1)
    expect(aggregates[0].players.get("anna")).toMatchObject({ roundsPlayed: 1, roundsWon: 1, roundsLost: 0 })
  })

  it("keeps formats apart", () => {
    const aggregates = buildAggregates([
      {
        id: "mixed",
        stage: { id: "md1", type: "GROUP" },
        subMatches: [
          { format: "ROUND_2V2", rounds: [round("anna", "ben", "opp1", "opp2")] },
          { format: "ROUND_1V1", rounds: [round("opp1", "anna")] },
        ],
      },
    ])

    expect(aggregates.map((a) => a.format)).toEqual(["ROUND_1V1", "ROUND_2V2"])
    expect(aggregates[0].players.get("anna")).toMatchObject({ roundsPlayed: 1, roundsLost: 1 })
    expect(aggregates[1].players.get("anna")).toMatchObject({ roundsPlayed: 1, roundsWon: 1 })
  })
})

describe("matchesOfLineups", () => {
  const first = match([], { tournamentLineupId: "lu1" })
  const second = match([], { tournamentLineupId: "lu2" })
  const third = match([], { tournamentLineupId: "lu3" })
  const without = match([], { tournamentLineupId: null })
  const all = [first, second, third, without]

  it("keeps every match, also those without a lineup, when no lineup is selected", () => {
    expect(matchesOfLineups(all, [])).toEqual(all)
  })

  it("keeps only the matches of the selected lineups", () => {
    expect(matchesOfLineups(all, ["lu1", "lu3"])).toEqual([first, third])
  })
})

describe("matchesOfStages", () => {
  const first = match([], { stage: { id: "md1", type: "GROUP" } })
  const second = match([], { stage: { id: "md2", type: "GROUP" } })
  const playoffs = match([], { stage: { id: "po", type: "PLAYOFF" } })
  const all = [first, second, playoffs]

  it("keeps every match when no stage is selected", () => {
    expect(matchesOfStages(all, [])).toEqual(all)
  })

  it("keeps only the matches of the selected stages", () => {
    expect(matchesOfStages(all, ["md1", "po"])).toEqual([first, playoffs])
  })
})
