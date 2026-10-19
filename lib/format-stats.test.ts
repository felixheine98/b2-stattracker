import { describe, expect, it } from "vitest"
import { pacePct } from "./pace"
import { buildAggregates, matchesOfLineups, matchesOfStages, type StatsMatch } from "./format-stats"
import type { SubMatchSummary } from "./summary"

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

describe("buildAggregates: pace", () => {
  // A round given as the finishing order with times in seconds
  function timed(...order: Array<[string, number | null]>) {
    return {
      results: order.map(([name, seconds]) => ({
        id: `r${nextId++}`, tmId: name, playerName: name, isOurTeam: !name.startsWith("opp"), dnf: seconds === null, timeMs: seconds === null ? null : seconds * 1000,
      })),
    }
  }

  it("averages a player's gap to the fastest time of each round in percent", () => {
    const [agg] = buildAggregates([match([timed(["opp1", 50], ["anna", 51]), timed(["anna", 60], ["opp1", 61])])])
    expect(pacePct(agg.players.get("anna")!.pace)).toBeCloseTo(1)
  })

  it("leaves rounds the player did not finish out of the pace", () => {
    const [agg] = buildAggregates([match([timed(["opp1", 50], ["anna", 51]), timed(["opp1", 60], ["anna", null])])])
    expect(agg.players.get("anna")!.pace.rounds).toBe(1)
    expect(pacePct(agg.players.get("anna")!.pace)).toBeCloseTo(2)
  })
})

describe("buildAggregates: summary results", () => {
  // A sub-match taken over from a stats screenshot: no rounds, only the result and per player
  // the rounds driven and the sum of their places (docs/adr/007)
  function summarised(summary: Partial<SubMatchSummary> & Pick<SubMatchSummary, "players">): StatsMatch {
    return {
      id: `m${nextId++}`,
      stage: { id: "md1", type: "GROUP" },
      subMatches: [{ format: "ROUND_2V2", rounds: [], summary: { track: null, rounds: 9, roundsWon: 2, roundsLost: 5, outcome: "L", ...summary } }],
    }
  }
  const player = (name: string, rounds: number, placementSum: number) => ({ playerId: name, tmId: name, playerName: name, rounds, placementSum })

  it("adds the rounds and the sum of places of each player", () => {
    const [agg] = buildAggregates([
      match([round("anna", "ben", "opp1", "opp2")]),
      summarised({ players: [player("anna", 9, 26), player("ben", 9, 24)] }),
    ])

    expect(agg.players.get("anna")).toMatchObject({ roundsPlayed: 10, placementSum: 27 })
    expect(agg.players.get("ben")).toMatchObject({ roundsPlayed: 10, placementSum: 26 })
  })

  it("counts the round result for the team and for every player who drove all rounds", () => {
    const [agg] = buildAggregates([summarised({ players: [player("anna", 9, 26), player("ben", 5, 14), player("cleo", 4, 10)] })])

    expect(agg).toMatchObject({ teamRoundsWon: 2, teamRoundsLost: 5, mapWon: 0, mapLost: 1, mapDrawn: 0 })
    expect(agg.players.get("anna")).toMatchObject({ roundsWon: 2, roundsLost: 5 })
    expect(agg.players.get("ben")).toMatchObject({ roundsWon: 0, roundsLost: 0 })
  })

  it("counts the map but no rounds won or lost when the screenshot gives no round result", () => {
    const [agg] = buildAggregates([summarised({ roundsWon: null, roundsLost: null, outcome: "W", players: [player("anna", 9, 26)] })])

    expect(agg).toMatchObject({ teamRoundsWon: 0, teamRoundsLost: 0, mapWon: 1 })
    expect(agg.players.get("anna")).toMatchObject({ roundsPlayed: 9, roundsWon: 0, roundsLost: 0 })
  })

  it("adds neither DNFs nor pace", () => {
    const [agg] = buildAggregates([summarised({ players: [player("anna", 9, 26)] })])

    expect(agg.players.get("anna")).toMatchObject({ dnfs: 0 })
    expect(agg.players.get("anna")!.pace.rounds).toBe(0)
  })
})
