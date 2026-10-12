import { describe, expect, it } from "vitest"
import { rankTfhDrivers, rankTfhTotals, splitTfhByKind } from "./tfh-ranking"

const driver = (sourceName: string, values: Partial<{ cpm: number | null; checkpoints: number | null; playTimeSeconds: number | null; bestLapMs: number | null; averageLapMs: number | null; finishes: unknown[] }> = {}) =>
  ({ sourceName, cpm: null, checkpoints: null, playTimeSeconds: null, bestLapMs: null, averageLapMs: null, finishes: [], ...values })

describe("rankTfhDrivers", () => {
  it("compares the drivers of all B2 teams of a race, the highest CPM first", () => {
    const teams = [
      { name: "B2 Alpha", isB2: true, drivers: [driver("Anna", { cpm: 3.1 }), driver("Ben", { cpm: 4.2 })] },
      { name: "B2 Beta", isB2: true, drivers: [driver("Cara", { cpm: 3.9 })] },
      { name: "Rivals", isB2: false, drivers: [driver("Dave", { cpm: 9.9 })] },
    ]
    expect(rankTfhDrivers(teams, "cpm").map(r => [r.rank, r.driver.sourceName, r.team.name])).toEqual([
      [1, "Ben", "B2 Alpha"],
      [2, "Cara", "B2 Beta"],
      [3, "Anna", "B2 Alpha"],
    ])
  })

  it("gives drivers with the same value the same rank and lists drivers without a value last, unranked", () => {
    const teams = [
      { name: "B2 Alpha", isB2: true, drivers: [driver("Zoe"), driver("Anna", { cpm: 3.5 }), driver("Ben", { cpm: 4.2 })] },
      { name: "B2 Beta", isB2: true, drivers: [driver("Cara", { cpm: 3.5 }), driver("Eli", { cpm: 2 }), driver("Abe")] },
    ]
    expect(rankTfhDrivers(teams, "cpm").map(r => [r.rank, r.driver.sourceName])).toEqual([
      [1, "Ben"],
      [2, "Anna"],
      [2, "Cara"],
      [4, "Eli"],
      [null, "Abe"],
      [null, "Zoe"],
    ])
  })

  it("ranks lap times with the fastest first and counts with the highest first", () => {
    const teams = [{ name: "B2 Alpha", isB2: true, drivers: [
      driver("Anna", { bestLapMs: 61000, averageLapMs: 70000, checkpoints: 900, playTimeSeconds: 7200, finishes: [1, 2, 3] }),
      driver("Ben", { bestLapMs: 60000, averageLapMs: 72000, checkpoints: 1200, playTimeSeconds: 3600, finishes: [1] }),
    ] }]
    const order = (metric: Parameters<typeof rankTfhDrivers>[1]) => rankTfhDrivers(teams, metric).map(r => r.driver.sourceName)
    expect(order("bestLapMs")).toEqual(["Ben", "Anna"])
    expect(order("averageLapMs")).toEqual(["Anna", "Ben"])
    expect(order("checkpoints")).toEqual(["Ben", "Anna"])
    expect(order("playTimeSeconds")).toEqual(["Anna", "Ben"])
    expect(order("finishes")).toEqual(["Anna", "Ben"])
  })

  it("can list the ranking from the bottom up, still with the unranked drivers last", () => {
    const teams = [{ name: "B2 Alpha", isB2: true, drivers: [driver("Anna", { cpm: 3 }), driver("Ben", { cpm: 4 }), driver("Zoe")] }]
    expect(rankTfhDrivers(teams, "cpm", "worst").map(r => [r.rank, r.driver.sourceName])).toEqual([[2, "Anna"], [1, "Ben"], [null, "Zoe"]])
  })
})

describe("rankTfhTotals", () => {
  const result = (playerId: string, raceId: string, values: { checkpoints?: number | null; playTimeSeconds?: number | null; finishes?: number; cpm?: number | null } = {}) =>
    ({ playerId, raceId, checkpoints: null, playTimeSeconds: null, finishes: 0, cpm: null, ...values })

  it("adds up what a driver did over all editions and ranks by the longest play time", () => {
    const results = [
      result("anna", "24h-4", { checkpoints: 900, playTimeSeconds: 20000 }),
      result("anna", "12h-3", { checkpoints: 400, playTimeSeconds: 9000 }),
      result("ben", "24h-4", { checkpoints: 1500, playTimeSeconds: 28000 }),
      result("cara", "12h-3", { checkpoints: 100, playTimeSeconds: 29000 }),
    ]
    expect(rankTfhTotals(results, "playTimeSeconds")).toMatchObject([
      { rank: 1, playerId: "anna", races: 2, checkpoints: 1300, playTimeSeconds: 29000, incomplete: false },
      { rank: 1, playerId: "cara", races: 1, checkpoints: 100, playTimeSeconds: 29000, incomplete: false },
      { rank: 3, playerId: "ben", races: 1, checkpoints: 1500, playTimeSeconds: 28000, incomplete: false },
    ])
  })

  it("shows the CPM of every edition next to each other, each with the rank among the B2 drivers of that edition", () => {
    const results = [
      result("anna", "24h-3", { cpm: 8 }),
      result("anna", "24h-4", { cpm: 9 }),
      result("ben", "24h-4", { cpm: 9.5 }),
      result("cara", "24h-3", { cpm: 8.4 }),
      result("cara", "24h-4"),
      result("dave", "24h-4", { cpm: 9 }),
    ]
    const editions = Object.fromEntries(rankTfhTotals(results, "races").map(t => [t.playerId, t.editions]))
    expect(editions).toEqual({
      anna: { "24h-3": { cpm: 8, rank: 2 }, "24h-4": { cpm: 9, rank: 2 } },
      ben: { "24h-4": { cpm: 9.5, rank: 1 } },
      cara: { "24h-3": { cpm: 8.4, rank: 1 }, "24h-4": { cpm: null, rank: null } },
      dave: { "24h-4": { cpm: 9, rank: 2 } },
    })
  })

  it("ranks by the CPM of one edition, with the drivers who have no value there last", () => {
    const results = [
      result("anna", "24h-3", { cpm: 8 }),
      result("anna", "24h-4", { cpm: 9 }),
      result("ben", "24h-4", { cpm: 9.5 }),
      result("cara", "24h-3", { cpm: 8.4 }),
      result("cara", "24h-4"),
      result("eli", "24h-3", { cpm: 7 }),
    ]
    expect(rankTfhTotals(results, "cpm:24h-4").map(t => [t.rank, t.playerId])).toEqual([[1, "ben"], [2, "anna"], [null, "cara"], [null, "eli"]])
    expect(rankTfhTotals(results, "cpm:24h-4", "worst").map(t => [t.rank, t.playerId])).toEqual([[2, "anna"], [1, "ben"], [null, "cara"], [null, "eli"]])
    expect(rankTfhTotals(results, "cpm:24h-3").map(t => [t.rank, t.playerId])).toEqual([[1, "cara"], [2, "anna"], [3, "eli"], [null, "ben"]])
  })

  it("adds up the finishes of all editions", () => {
    const results = [
      result("anna", "24h-3", { finishes: 70 }),
      result("anna", "24h-4", { finishes: 84 }),
      result("ben", "24h-4", { finishes: 160 }),
    ]
    expect(rankTfhTotals(results, "finishes").map(t => [t.rank, t.playerId, t.finishes])).toEqual([[1, "ben", 160], [2, "anna", 154]])
  })

  it("ranks by editions or checkpoints as well, and from the bottom up", () => {
    const results = [
      result("anna", "24h-4", { checkpoints: 900, playTimeSeconds: 20000 }),
      result("anna", "12h-3", { checkpoints: 400, playTimeSeconds: 9000 }),
      result("ben", "24h-4", { checkpoints: 1500, playTimeSeconds: 28000 }),
    ]
    expect(rankTfhTotals(results, "races").map(t => [t.rank, t.playerId])).toEqual([[1, "anna"], [2, "ben"]])
    expect(rankTfhTotals(results, "checkpoints").map(t => [t.rank, t.playerId])).toEqual([[1, "ben"], [2, "anna"]])
    expect(rankTfhTotals(results, "checkpoints", "worst").map(t => [t.rank, t.playerId])).toEqual([[2, "anna"], [1, "ben"]])
  })

  it("counts an edition once per driver and marks totals with values the source did not supply", () => {
    const results = [
      result("anna", "24h-4", { checkpoints: 900, playTimeSeconds: 20000 }),
      result("anna", "24h-4", { checkpoints: 50, playTimeSeconds: 600 }),
      result("ben", "12h-3", { checkpoints: 300 }),
    ]
    expect(rankTfhTotals(results, "playTimeSeconds")).toMatchObject([
      { rank: 1, playerId: "anna", races: 1, checkpoints: 950, playTimeSeconds: 20600, incomplete: false },
      { rank: 2, playerId: "ben", races: 1, checkpoints: 300, playTimeSeconds: 0, incomplete: true },
    ])
  })
})

describe("splitTfhByKind", () => {
  it("keeps 24h and 12h races apart, the 24h races first, and leaves out a kind nobody drove", () => {
    const results = [
      { playerId: "anna", kind: "12h" },
      { playerId: "ben", kind: "24h" },
      { playerId: "anna", kind: "24h" },
    ]
    expect(splitTfhByKind(results)).toEqual([
      { kind: "24h", results: [{ playerId: "ben", kind: "24h" }, { playerId: "anna", kind: "24h" }] },
      { kind: "12h", results: [{ playerId: "anna", kind: "12h" }] },
    ])
    expect(splitTfhByKind([{ playerId: "anna", kind: "12h" }]).map(g => g.kind)).toEqual(["12h"])
    expect(splitTfhByKind([])).toEqual([])
  })
})
