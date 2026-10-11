import { describe, expect, it } from "vitest"
import { buildProfile, type ProfileMatch, type ProfileTournament } from "./player-profile"

let nextId = 0

// A round given as the finishing order, "name:seconds"; names starting with "opp" are the
// opponents, a "!" instead of the seconds marks a DNF
function round(track: string, ...order: string[]) {
  return {
    track,
    results: order.map((entry) => {
      const [name, time] = entry.split(":")
      const dnf = time === "!"
      return { playerId: name.startsWith("opp") ? null : name, isOurTeam: !name.startsWith("opp"), dnf, timeMs: dnf ? null : Number(time) * 1000 }
    }),
  }
}

function match(rounds: ReturnType<typeof round>[], extra: Partial<ProfileMatch> = {}): ProfileMatch {
  return {
    id: `m${nextId++}`,
    tournamentId: "t1",
    tournamentLineupId: "alpha",
    stage: { type: "GROUP" },
    subMatches: [{ format: "ROUND_2V2", rounds }],
    ...extra,
  }
}

const t1: ProfileTournament = { id: "t1", lineups: [{ id: "alpha", playerIds: ["anna", "ben"] }, { id: "bravo", playerIds: ["cleo"] }] }

describe("buildProfile: comps", () => {
  it("lists a comp for a player in the roster who never drove, as not deployed", () => {
    const profile = buildProfile("ben", [t1], [match([round("A", "anna:60", "opp1:61")])])
    expect(profile.comps).toHaveLength(1)
    expect(profile.comps[0]).toMatchObject({ tournamentId: "t1", lineupIds: ["alpha"], inRoster: true, deployed: false })
  })

  it("lists a comp for a stand-in outside the roster, with the lineup of the match", () => {
    const profile = buildProfile("dora", [t1], [match([round("A", "dora:60", "opp1:61")], { tournamentLineupId: "bravo" })])
    expect(profile.comps[0]).toMatchObject({ lineupIds: ["bravo"], inRoster: false, deployed: true })
  })

  it("names the roster lineup first and adds other lineups the player drove for", () => {
    const profile = buildProfile("anna", [t1], [match([round("A", "anna:60", "opp1:61")], { tournamentLineupId: "bravo" })])
    expect(profile.comps[0].lineupIds).toEqual(["alpha", "bravo"])
  })

  it("leaves out comps the player has nothing to do with and keeps the given order", () => {
    const t2: ProfileTournament = { id: "t2", lineups: [{ id: "x", playerIds: ["anna"] }] }
    const t3: ProfileTournament = { id: "t3", lineups: [{ id: "y", playerIds: ["ben"] }] }
    expect(buildProfile("anna", [t2, t3, t1], []).comps.map((c) => c.tournamentId)).toEqual(["t2", "t1"])
  })
})

describe("buildProfile: stats", () => {
  it("sums up rounds, placements, DNFs and won rounds per format and in total", () => {
    const profile = buildProfile("anna", [t1], [
      match([round("A", "anna:60", "ben:61", "opp1:62", "opp2:63"), round("A", "opp1:60", "opp2:61", "ben:62", "anna:!")]),
      match([round("A", "anna:60", "opp1:61")], { subMatches: [{ format: "ROUND_1V1", rounds: [round("A", "anna:60", "opp1:61")] }] }),
    ])
    expect(profile.total).toMatchObject({ roundsPlayed: 3, placementSum: 6, dnfs: 1, roundsWon: 2, roundsLost: 1 })
    expect(profile.formats.map((f) => f.format)).toEqual(["ROUND_1V1", "ROUND_2V2"])
    expect(profile.formats[1]).toMatchObject({ roundsPlayed: 2, placementSum: 5, dnfs: 1, roundsWon: 1, roundsLost: 1 })
    expect(profile.comps[0].total).toMatchObject({ roundsPlayed: 3 })
    expect(profile.comps[0].formats).toHaveLength(2)
  })

  it("leaves seeding matches out of the stats", () => {
    const profile = buildProfile("anna", [t1], [
      match([round("A", "anna:60", "opp1:61")]),
      match([round("A", "anna:59")], { stage: { type: "SEEDING" }, subMatches: [{ format: "TIME_ATTACK_10", rounds: [round("A", "anna:59")] }] }),
    ])
    expect(profile.total.roundsPlayed).toBe(1)
    expect(profile.formats.map((f) => f.format)).toEqual(["ROUND_2V2"])
    expect(profile.comps[0].matches).toHaveLength(1)
  })

  it("gives the pace as the average gap to the fastest time of each round, without DNFs", () => {
    const profile = buildProfile("anna", [t1], [
      match([round("A", "opp1:50", "anna:51", "ben:52"), round("A", "anna:60", "opp1:61"), round("A", "opp1:60", "anna:!")]),
    ])
    // +2 % and +0 %
    expect(profile.total.pace.value).toBeCloseTo(1)
  })

  it("ranks the pace among everyone with a timed round and gives the team average over all results", () => {
    const profile = buildProfile("ben", [t1], [
      match([round("A", "opp1:50", "anna:51", "ben:52"), round("A", "opp1:50", "anna:50.5", "cleo:!")]),
    ])
    // anna +1.5 %, ben +4 %; cleo has no timed round and is not ranked
    expect(profile.total.pace).toMatchObject({ rank: 2, of: 2 })
    expect(profile.total.pace.value).toBeCloseTo(4)
    // (2 + 4 + 1) / 3 results
    expect(profile.total.pace.team).toBeCloseTo(7 / 3)
  })

  it("has no rank without a timed round", () => {
    const profile = buildProfile("cleo", [t1], [match([round("A", "opp1:50", "anna:51", "cleo:!")])])
    expect(profile.total.pace).toMatchObject({ value: null, rank: null, of: 1 })
  })

  it("lists the matches the player drove in with rounds and pace", () => {
    const first = match([round("A", "opp1:50", "anna:51")])
    const other = match([round("A", "opp1:50", "ben:51")])
    const profile = buildProfile("anna", [t1], [first, other])
    expect(profile.comps[0].matches).toHaveLength(1)
    expect(profile.comps[0].matches[0]).toMatchObject({ matchId: first.id, roundsPlayed: 1 })
    expect(profile.comps[0].matches[0].pace).toBeCloseTo(2)
  })
})

describe("buildProfile: maps", () => {
  it("gives the personal best per map with its match, rank and gap to the fastest of our players", () => {
    const first = match([round("A", "opp1:59", "ben:60", "anna:62")])
    const second = match([round("A", "anna:61", "opp1:63"), round("B", "anna:70", "opp1:71")])
    const profile = buildProfile("anna", [t1], [first, second])
    const [a, b] = profile.comps[0].maps
    expect(a).toMatchObject({ track: "A", pbMs: 61000, pbMatchId: second.id, pbRank: 2, pbOf: 2, pbGapMs: 1000 })
    expect(b).toMatchObject({ track: "B", pbMs: 70000, pbRank: 1, pbOf: 1, pbGapMs: 0 })
  })

  it("gives the average gap to the fastest time of the round in milliseconds, with a rank", () => {
    const profile = buildProfile("anna", [t1], [
      match([round("A", "opp1:60", "anna:61", "ben:63"), round("A", "anna:60", "opp1:61", "ben:!")]),
    ])
    expect(profile.comps[0].maps[0]).toMatchObject({ rounds: 2, avgGapMs: 500, avgGapRank: 1, avgGapOf: 2 })
  })

  it("counts seeding times for the personal best but not for the average gap", () => {
    const profile = buildProfile("anna", [t1], [
      match([round("A", "opp1:60", "anna:61")]),
      match([], { stage: { type: "SEEDING" }, subMatches: [{ format: "TIME_ATTACK_10", rounds: [round("A", "anna:59", "ben:58")] }] }),
    ])
    expect(profile.comps[0].maps[0]).toMatchObject({ pbMs: 59000, pbRank: 2, pbGapMs: 1000, rounds: 1, avgGapMs: 1000 })
  })

  it("keeps maps of different comps apart", () => {
    const t2: ProfileTournament = { id: "t2", lineups: [] }
    const profile = buildProfile("anna", [t1, t2], [
      match([round("A", "anna:60", "opp1:61")]),
      match([round("A", "anna:50", "opp1:51")], { tournamentId: "t2" }),
    ])
    expect(profile.comps.map((c) => c.maps[0].pbMs)).toEqual([60000, 50000])
  })
})
