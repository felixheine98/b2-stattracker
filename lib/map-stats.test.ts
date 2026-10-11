import { describe, expect, it } from "vitest"
import { matchesOfFormats, type StatsMatch } from "./format-stats"
import { buildMapAggregates, mapGapMs, teamAvgMs } from "./map-stats"

let nextId = 0

// A round on a map, given as the finishing order "name:seconds"; names starting with "opp" are
// the opponents, a "!" instead of the seconds marks a DNF
function round(track: string | null, ...order: string[]) {
  return {
    track,
    results: order.map((entry) => {
      const [name, time] = entry.split(":")
      const dnf = time === "!"
      return { id: `r${nextId++}`, tmId: name, playerName: name, isOurTeam: !name.startsWith("opp"), dnf, timeMs: dnf ? null : Number(time) * 1000 }
    }),
  }
}

function match(subMatches: StatsMatch["subMatches"], extra: Partial<StatsMatch> = {}): StatsMatch {
  return { id: `m${nextId++}`, stage: { id: "md1", type: "GROUP" }, subMatches, ...extra }
}

const sub = (format: StatsMatch["subMatches"][number]["format"], ...rounds: ReturnType<typeof round>[]) => ({ format, rounds })

describe("buildMapAggregates", () => {
  it("sums up a player's rounds per map over all formats", () => {
    const [a, b] = buildMapAggregates([
      match([
        sub("ROUND_1V1", round("A", "anna:60", "opp1:61"), round("A", "opp1:60", "anna:62")),
        sub("ROUND_2V2", round("A", "anna:61", "ben:62", "opp1:63", "opp2:64"), round("B", "opp1:50", "opp2:51", "anna:52", "ben:!")),
      ]),
    ], ["md1"])
    expect(a).toMatchObject({ track: "A", formats: ["ROUND_1V1", "ROUND_2V2"] })
    expect(a.players.get("anna")).toMatchObject({ rounds: 3, bestMs: 60000, dnfs: 0, roundsWon: 2, roundsLost: 1 })
    expect(b.track).toBe("B")
    expect(b.players.get("ben")).toMatchObject({ rounds: 1, bestMs: null, dnfs: 1, roundsLost: 1 })
  })

  it("averages the gap to the fastest time of each round in milliseconds, without DNFs", () => {
    const [a] = buildMapAggregates([
      match([sub("ROUND_1V1", round("A", "opp1:60", "anna:61"), round("A", "anna:60", "opp1:63"), round("A", "opp1:60", "anna:!"))]),
    ], ["md1"])
    expect(mapGapMs(a.players.get("anna")!)).toBe(500)
  })

  it("counts won and lost maps and rounds of the team per map", () => {
    const [a, b] = buildMapAggregates([
      match([
        sub("ROUND_1V1", round("A", "anna:60", "opp1:61"), round("A", "anna:60", "opp1:61"), round("A", "opp1:60", "anna:61")),
        sub("ROUND_1V1", round("B", "opp1:60", "anna:61")),
      ]),
    ], ["md1"])
    expect(a).toMatchObject({ mapWon: 1, mapLost: 0, teamRoundsWon: 2, teamRoundsLost: 1 })
    expect(b).toMatchObject({ mapWon: 0, mapLost: 1, teamRoundsWon: 0, teamRoundsLost: 1 })
  })

  it("gives the best and the average time of our drivers on a map, without the opponents and DNFs", () => {
    const [a] = buildMapAggregates([
      match([sub("ROUND_2V2", round("A", "opp1:58", "anna:60", "ben:62", "opp2:70"), round("A", "anna:61", "opp1:62", "opp2:63", "ben:!"))]),
    ], ["md1"])
    expect(a.teamBestMs).toBe(60000)
    expect(teamAvgMs(a)).toBe(61000)
  })

  it("has no team times while none of ours finished", () => {
    const [a] = buildMapAggregates([match([sub("ROUND_1V1", round("A", "opp1:58", "anna:!"))])], ["md1"])
    expect(a.teamBestMs).toBeNull()
    expect(teamAvgMs(a)).toBeNull()
  })

  it("lists the maps in the order they were first played, then by name", () => {
    const maps = buildMapAggregates([
      match([sub("ROUND_1V1", round("Zeta", "anna:60", "opp1:61"))], { stage: { id: "md2", type: "GROUP" } }),
      match([sub("ROUND_1V1", round("Beta", "anna:60", "opp1:61")), sub("ROUND_1V1", round("Alpha", "anna:60", "opp1:61"))]),
    ], ["md1", "md2"])
    expect(maps.map((m) => m.track)).toEqual(["Alpha", "Beta", "Zeta"])
  })

  it("treats differently written names as the same map and keeps the first spelling", () => {
    const maps = buildMapAggregates([
      match([sub("ROUND_1V1", round("Cocoon", "anna:60", "opp1:61"), round(" cocoon ", "anna:59", "opp1:61"))]),
    ], ["md1"])
    expect(maps).toHaveLength(1)
    expect(maps[0].track).toBe("Cocoon")
    expect(maps[0].players.get("anna")).toMatchObject({ rounds: 2, bestMs: 59000 })
  })

  it("puts rounds without a map last", () => {
    const maps = buildMapAggregates([
      match([sub("ROUND_1V1", round(null, "anna:60", "opp1:61"), round("A", "anna:60", "opp1:61"))]),
    ], ["md1"])
    expect(maps.map((m) => m.track)).toEqual(["A", null])
  })

  it("leaves seeding matches out", () => {
    const maps = buildMapAggregates([
      match([sub("TIME_ATTACK_10", round("A", "anna:55"))], { stage: { id: "seed", type: "SEEDING" } }),
      match([sub("ROUND_1V1", round("A", "anna:60", "opp1:61"))]),
    ], ["seed", "md1"])
    expect(maps[0].players.get("anna")).toMatchObject({ rounds: 1, bestMs: 60000 })
  })
})

describe("matchesOfFormats", () => {
  const matches = [match([sub("ROUND_1V1", round("A", "anna:60", "opp1:61")), sub("ROUND_2V2", round("A", "anna:60", "ben:61", "opp1:62", "opp2:63"))])]

  it("keeps every sub-match when no format is given", () => {
    expect(matchesOfFormats(matches, [])[0].subMatches).toHaveLength(2)
  })

  it("keeps only the sub-matches of the given formats", () => {
    expect(matchesOfFormats(matches, ["ROUND_2V2"])[0].subMatches.map((s) => s.format)).toEqual(["ROUND_2V2"])
  })
})
