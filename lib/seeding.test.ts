import { describe, expect, it } from "vitest"
import { SEEDING_TYPES, assignScores, seedingScore, mapsDrivenTwice, placeRun, readSeeding, runLabel, seedingChoiceOf, seedingRuns, seedingSettings, slotLabel } from "./seeding"

describe("seeding types", () => {
  it("start the EMC seeding with its numbers: 2 maps, 2 times each, 2 servers, 10 rounds, the best 3 per map", () => {
    expect(SEEDING_TYPES.EMC.defaults).toEqual({
      maps: 2, slotsPerMap: 2, servers: 2, rounds: 10, best: 3,
      points: [10, 6, 4, 3, 2, 1], times: ["18:00", "18:30", "19:00", "19:30"],
    })
  })

  it("read a comp's numbers over the type's, and refuse ones that do not fit", () => {
    expect(seedingSettings("EMC", null)).toEqual(SEEDING_TYPES.EMC.defaults)
    expect(seedingSettings("EMC", { best: 4, maps: 3, times: ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30"] })).toMatchObject({ best: 4, maps: 3, slotsPerMap: 2 })
    expect(seedingSettings(null, {})).toBeNull()
    expect(seedingSettings("XYZ", {})).toBeNull()
    // More counted scores than runs on a map, or a time per run that is missing
    expect(() => seedingSettings("EMC", { best: 5 })).toThrow()
    expect(() => seedingSettings("EMC", { maps: 3 })).toThrow()
    expect(() => seedingSettings("EMC", { points: [-1] })).toThrow()
  })

  it("lay out one run per map, time and server, in playing order", () => {
    const runs = seedingRuns(SEEDING_TYPES.EMC.defaults)
    expect(runs).toHaveLength(8)
    expect(runs.slice(0, 3)).toEqual([{ map: 0, slot: 0, server: 0 }, { map: 0, slot: 0, server: 1 }, { map: 0, slot: 1, server: 0 }])
    expect(runs.at(-1)).toEqual({ map: 1, slot: 3, server: 1 })
  })

  it("name a time slot by its time, or by its number where none is given", () => {
    expect(slotLabel(SEEDING_TYPES.EMC.defaults, 2)).toBe("19:00")
    expect(slotLabel({ ...SEEDING_TYPES.EMC.defaults, times: [] }, 2)).toBe("Slot 3")
  })

  it("read a comp's seeding from a request: the type with all its numbers, none, or what is wrong", () => {
    expect(readSeeding({ type: "EMC", settings: { best: 4 } })).toEqual({ seedingType: "EMC", seedingSettings: { ...SEEDING_TYPES.EMC.defaults, best: 4 } })
    expect(readSeeding(null)).toEqual({ seedingType: null, seedingSettings: null })
    expect(readSeeding({ type: "XYZ", settings: {} })).toEqual({ error: "Unknown seeding format." })
    expect(readSeeding({ type: "EMC", settings: { best: 9 } })).toEqual({ error: "Seeding: More counted scores than runs on a map." })
  })

  it("name a run by its map, by name where the maps have one, time and server", () => {
    expect(runLabel(SEEDING_TYPES.EMC.defaults, { map: 1, slot: 2, server: 0 })).toBe("Map 2 · 19:00 · Server 1")
    expect(runLabel(SEEDING_TYPES.EMC.defaults, { map: 1, slot: 2, server: 0 }, ["Bernage", "Incendiary"])).toBe("Incendiary · 19:00 · Server 1")
  })

  it("start the comp dialog with the stored seeding, the type's numbers filling what is missing", () => {
    expect(seedingChoiceOf("EMC", { best: 4 })).toEqual({ type: "EMC", settings: { ...SEEDING_TYPES.EMC.defaults, best: 4 } })
    expect(seedingChoiceOf(null, null)).toBeNull()
    expect(seedingChoiceOf("XYZ", {})).toBeNull()
  })
})

describe("planning the runs", () => {
  const emc = SEEDING_TYPES.EMC.defaults
  // Runs 0-3 are on map 1, runs 4-7 on map 2
  const empty = () => Array<string | null>(8).fill(null)

  it("put a player on a run, also on the other map", () => {
    const one = placeRun(emc, empty(), 0, "a")!
    expect(one).toEqual(["a", null, null, null, null, null, null, null])
    expect(placeRun(emc, one, 5, "a")).toEqual(["a", null, null, null, null, "a", null, null])
  })

  it("refuse a second run on the same map", () => {
    expect(placeRun(emc, ["a", null, null, null, null, null, null, null], 3, "a")).toBeNull()
  })

  it("move a run's player to another run, swapping with whoever drives there", () => {
    expect(placeRun(emc, ["a", null, "b", null, null, null, null, null], 2, "a", 0)).toEqual(["b", null, "a", null, null, null, null, null])
    expect(placeRun(emc, ["a", null, null, null, null, null, null, null], 1, "a", 0)).toEqual([null, "a", null, null, null, null, null, null])
  })

  it("swap players across the maps only where neither then drives a map twice", () => {
    // a from map 1 onto b's run on map 2: b would come to map 1, where b already drives
    expect(placeRun(emc, ["a", "b", null, null, "b", null, null, null], 4, "a", 0)).toBeNull()
    expect(placeRun(emc, ["a", null, null, null, "b", null, null, null], 4, "a", 0)).toEqual(["b", null, null, null, "a", null, null, null])
  })

  it("free a run", () => {
    expect(placeRun(emc, ["a", null, null, null, null, null, null, null], 0, null)).toEqual(empty())
  })

  it("name the players who drive a map twice", () => {
    expect(mapsDrivenTwice(emc, ["a", "a", null, null, "a", "b", "b", null])).toEqual([{ playerId: "a", map: 0 }, { playerId: "b", map: 1 }])
    expect(mapsDrivenTwice(emc, ["a", "b", null, null, "a", "b", null, null])).toEqual([])
  })
})

describe("putting the scores of a map on its runs", () => {
  const emc = SEEDING_TYPES.EMC.defaults
  // Runs 0-3 are on map 1, runs 4-7 on map 2
  const runs = (planned: Array<string | null>, recorded: Array<string | null> = []) => planned.map((p, i) => ({ planned: p, recorded: recorded[i] ?? null }))

  it("put a score on the run the player drove or was planned for on that map", () => {
    const result = assignScores(emc, runs(["a", "b", "c", null, "b", null, null, null], [null, null, null, null, null, null, "d", null]), [
      [{ playerId: "c", score: 300 }, { playerId: "a", score: 463 }],
      [{ playerId: "d", score: 120 }],
    ])
    expect(result.runs).toEqual([
      { playerId: "a", score: 463 }, { playerId: null, score: null }, { playerId: "c", score: 300 }, { playerId: null, score: null },
      { playerId: null, score: null }, { playerId: null, score: null }, { playerId: "d", score: 120 }, { playerId: null, score: null },
    ])
    expect(result.unplaced).toEqual([])
  })

  it("put an unplanned player on a free run of the map, and report who does not fit", () => {
    const result = assignScores(emc, runs(["a", "b", null, null, null, null, null, null]), [
      [{ playerId: "e", score: 1 }, { playerId: "f", score: 2 }, { playerId: "g", score: 3 }, { playerId: "h", score: 4 }, { playerId: "a", score: 5 }],
      [],
    ])
    // a keeps the planned run; e, f and g fill the others in the sheet's order, b's planned run included
    expect(result.runs.slice(0, 4)).toEqual([{ playerId: "a", score: 5 }, { playerId: "e", score: 1 }, { playerId: "f", score: 2 }, { playerId: "g", score: 3 }])
    expect(result.unplaced).toEqual([{ map: 0, playerId: "h", score: 4 }])
  })
})

describe("the score of a lineup's seeding", () => {
  const emc = SEEDING_TYPES.EMC.defaults
  const run = (playerId: string | null, score: number | null) => ({ playerId, score })

  it("count the best 3 scores of each map and add them up, as the S7 master sheet did for B2 Academy", () => {
    const score = seedingScore(emc, [
      run("crypii", 463), run("p3k", 382), run("siri", 298), run("hyper", 315),
      run("benny", 380), run("parzival", 386), run("surv", 276), run("s0nity", 196),
    ])
    expect(score.maps).toEqual([{ sum: 1160, counted: [0, 1, 3] }, { sum: 1042, counted: [4, 5, 6] }])
    expect(score.total).toBe(2202)
  })

  it("count what there is while runs are open, and nothing without any score", () => {
    expect(seedingScore(emc, [run("a", 100), run(null, null), run("b", 0)]).maps[0]).toEqual({ sum: 100, counted: [0, 2] })
    expect(seedingScore(emc, []).total).toBeNull()
  })
})
