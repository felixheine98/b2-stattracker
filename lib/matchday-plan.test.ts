import { describe, expect, it } from "vitest"
import type { Seats } from "./matchday-plan"
import { hasUnpublishedChanges, matchLineup, planHints, planPool, publishedSnapshot } from "./matchday-plan"

const kader = ["anna", "ben", "cleo", "dora", "emil"].map((id) => ({ id }))

describe("planPool", () => {
  it("puts fixed and partly available players on top, maybe and unanswered below, and leaves out who is out", () => {
    const pool = planPool(kader, { anna: "MAYBE", ben: "FIX", cleo: "OUT", dora: "PARTIAL" })
    expect(pool.top.map((p) => p.id)).toEqual(["ben", "dora"])
    expect(pool.below.map((p) => p.id)).toEqual(["anna", "emil"])
    expect(pool.out.map((p) => p.id)).toEqual(["cleo"])
  })
})

describe("matchLineup", () => {
  const match = { id: "m1", formats: ["ROUND_1V1", "ROUND_2V2"] as const }

  it("follows the day lineup for every format of the match", () => {
    const variant = { day: { ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "cleo"], ROUND_3V3: ["anna", "ben", "cleo"] }, matches: {} }
    expect(matchLineup(variant, match)).toEqual({ ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "cleo"] })
  })

  it("takes a lineup of the match's own for a format over the day lineup", () => {
    const variant = { day: { ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "cleo"] }, matches: { m1: { ROUND_2V2: ["ben", "dora"] }, m2: { ROUND_1V1: ["emil"] } } }
    expect(matchLineup(variant, match)).toEqual({ ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "dora"] })
  })

  it("gives each format as many places as it needs drivers, open ones as null", () => {
    const variant = { day: { ROUND_2V2: ["ben"] }, matches: { m1: { ROUND_1V1: ["anna", "emil"] } } }
    expect(matchLineup(variant, match)).toEqual({ ROUND_1V1: ["anna"], ROUND_2V2: ["ben", null] })
  })
})

describe("planHints", () => {
  const m1 = { id: "m1", formats: ["ROUND_1V1", "ROUND_2V2"] as const }
  const m2 = { id: "m2", formats: ["ROUND_1V1"] as const }

  it("names every open place per match and format", () => {
    const variant = { day: { ROUND_1V1: ["anna"], ROUND_2V2: ["ben"] }, matches: { m2: { ROUND_1V1: [] } } }
    expect(planHints(variant, [m1, m2], {}, [])).toEqual([
      { matchId: "m1", format: "ROUND_2V2", kind: "open", count: 1 },
      { matchId: "m2", format: "ROUND_1V1", kind: "open", count: 1 },
    ])
  })

  it("names planned players who are out, and those absent from a single match", () => {
    const variant = { day: { ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "cleo"] }, matches: {} }
    expect(planHints(variant, [m1, m2], { cleo: "OUT", anna: "PARTIAL" }, [{ playerId: "anna", matchId: "m2" }])).toEqual([
      { matchId: "m1", format: "ROUND_2V2", kind: "out", playerId: "cleo" },
      { matchId: "m2", format: "ROUND_1V1", kind: "absent", playerId: "anna" },
    ])
  })
})

describe("published state", () => {
  const m1 = { id: "m1", formats: ["ROUND_1V1", "ROUND_2V2"] as const }
  const m2 = { id: "m2", formats: ["ROUND_1V1"] as const }
  const variant = { day: { ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "cleo"] }, matches: { m2: { ROUND_1V1: ["dora"] } } }

  it("holds the lineup of every match, and the day lineup for matches added later", () => {
    const snapshot = publishedSnapshot(variant, [m1, m2])
    expect(matchLineup(snapshot, m1)).toEqual({ ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "cleo"] })
    expect(matchLineup(snapshot, m2)).toEqual({ ROUND_1V1: ["dora"] })
    expect(matchLineup(snapshot, { id: "later", formats: ["ROUND_2V2"] })).toEqual({ ROUND_2V2: ["ben", "cleo"] })
  })

  it("stays as published when the day lineup changes afterwards", () => {
    const snapshot = publishedSnapshot(variant, [m1, m2])
    variant.day.ROUND_1V1 = ["emil"]
    expect(matchLineup(snapshot, m1).ROUND_1V1).toEqual(["anna"])
    variant.day.ROUND_1V1 = ["anna"]
  })

  it("tells whether the planning differs from what was published", () => {
    const current = () => ({ day: { ROUND_1V1: ["anna"], ROUND_2V2: ["ben", "cleo"] }, matches: { m2: { ROUND_1V1: ["dora"] } } as Record<string, Seats> })
    const snapshot = publishedSnapshot(current(), [m1, m2])
    expect(hasUnpublishedChanges(snapshot, current(), [m1, m2])).toBe(false)

    const swapped = current()
    swapped.matches.m1 = { ROUND_2V2: ["ben", "emil"] }
    expect(hasUnpublishedChanges(snapshot, swapped, [m1, m2])).toBe(true)

    const newDay = current()
    newDay.day.ROUND_2V2 = ["ben", "emil"]
    expect(hasUnpublishedChanges(snapshot, newDay, [m2])).toBe(true)
  })

  it("does not count a match added after finalising as a change", () => {
    const snapshot = publishedSnapshot(variant, [m1])
    expect(hasUnpublishedChanges(snapshot, variant, [m1, m2, { id: "m3", formats: ["ROUND_2V2"] }])).toBe(true)
    const plain = { day: variant.day, matches: {} }
    expect(hasUnpublishedChanges(publishedSnapshot(plain, [m1]), plain, [m1, { id: "m3", formats: ["ROUND_2V2"] }])).toBe(false)
  })
})
