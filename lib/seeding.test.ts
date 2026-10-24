import { describe, expect, it } from "vitest"
import { SEEDING_TYPES, readSeeding, runLabel, seedingChoiceOf, seedingRuns, seedingSettings, slotLabel } from "./seeding"

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

  it("name a run by its map, time and server", () => {
    expect(runLabel(SEEDING_TYPES.EMC.defaults, { map: 1, slot: 2, server: 0 })).toBe("Map 2 · 19:00 · Server 1")
  })

  it("start the comp dialog with the stored seeding, the type's numbers filling what is missing", () => {
    expect(seedingChoiceOf("EMC", { best: 4 })).toEqual({ type: "EMC", settings: { ...SEEDING_TYPES.EMC.defaults, best: 4 } })
    expect(seedingChoiceOf(null, null)).toBeNull()
    expect(seedingChoiceOf("XYZ", {})).toBeNull()
  })
})
