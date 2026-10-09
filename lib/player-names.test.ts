import { describe, expect, it } from "vitest"
import { allNames, applyCompNames, currentName, nameAt, planNameFrom } from "./player-names"

const change = (name: string, effectiveFrom: string) => ({ id: `${name}-${effectiveFrom}`, name, effectiveFrom })
// Was "Raiiinnnn" from the beginning, "raiin" from 1 July, "raiin.wav" from 1 September (given out of order)
const rain = { initialName: "Raiiinnnn", nameChanges: [change("raiin.wav", "2026-09-01"), change("raiin", "2026-07-01")] }

describe("nameAt", () => {
  it("is the initial name before the first rename", () => {
    expect(nameAt(rain, "2026-06-07")).toBe("Raiiinnnn")
  })

  it("is the name of the latest rename up to that day, the day itself included", () => {
    expect(nameAt(rain, "2026-07-01")).toBe("raiin")
    expect(nameAt(rain, "2026-08-31")).toBe("raiin")
    expect(nameAt(rain, new Date("2026-10-09"))).toBe("raiin.wav")
  })
})

describe("currentName", () => {
  it("is the name of the most recent rename, or the initial name without any", () => {
    expect(currentName(rain)).toBe("raiin.wav")
    expect(currentName({ initialName: "Uso", nameChanges: [] })).toBe("Uso")
  })
})

describe("allNames", () => {
  it("lists every name once, oldest first", () => {
    const back = { initialName: "A", nameChanges: [change("B", "2026-01-01"), change("A", "2026-02-01")] }
    expect(allNames(rain)).toEqual(["Raiiinnnn", "raiin", "raiin.wav"])
    expect(allNames(back)).toEqual(["A", "B"])
  })
})

describe("planNameFrom", () => {
  const today = "2026-10-09"

  it("adds the name from that day and keeps today's name with a second entry", () => {
    const player = { initialName: "raiin.wav", nameChanges: [] }
    expect(planNameFrom(player, "Raiiinnnn", "2026-06-07", today)).toEqual([
      { name: "Raiiinnnn", effectiveFrom: "2026-06-07" },
      { name: "raiin.wav", effectiveFrom: today },
    ])
  })

  it("adds only the name when a later rename already follows", () => {
    const player = { initialName: "Old", nameChanges: [change("New", "2026-08-01")] }
    expect(planNameFrom(player, "Middle", "2026-06-07", today)).toEqual([{ name: "Middle", effectiveFrom: "2026-06-07" }])
  })

  it("is a plain rename when the day is today", () => {
    const player = { initialName: "Old", nameChanges: [] }
    expect(planNameFrom(player, "New", today, today)).toEqual([{ name: "New", effectiveFrom: today }])
  })

  it("changes nothing when the player already has that name on that day", () => {
    expect(planNameFrom(rain, "raiin", "2026-07-15", today)).toEqual([])
  })
})

describe("applyCompNames", () => {
  const players = [{ id: "p1", ...rain }]
  const loaded = {
    id: "t1",
    name: "Vertigo S1",
    date: new Date("2026-06-07"),
    slots: [{ id: "s1", player: { id: "p1", tmId: "tm-1", name: "raiin.wav" } }],
    results: [
      { id: "r1", playerId: "p1", playerName: "raiin.wav" },
      { id: "r2", playerId: null, playerName: "Opponent" },
    ],
  }

  it("gives players and their results the name they had on that day", () => {
    const named = applyCompNames(loaded, players, "2026-06-07")
    expect(named.slots[0].player).toMatchObject({ name: "Raiiinnnn", currentName: "raiin.wav", allNames: ["Raiiinnnn", "raiin", "raiin.wav"] })
    expect(named.results[0]).toMatchObject({ playerName: "Raiiinnnn", currentName: "raiin.wav" })
  })

  it("leaves everything else as it is", () => {
    const named = applyCompNames(loaded, players, "2026-06-07")
    expect(named.name).toBe("Vertigo S1")
    expect(named.date).toBe(loaded.date)
    expect(named.results[1]).toEqual({ id: "r2", playerId: null, playerName: "Opponent" })
    expect(loaded.slots[0].player.name).toBe("raiin.wav")
  })
})
