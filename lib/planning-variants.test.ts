import { describe, expect, it } from "vitest"
import { adoptionPlan, applyAction, defaultLineupNames, nextVariantName, variantBoard, type VariantData } from "./planning-variants"
import type { Answer } from "./planning"

const row = (id: string, answer: Answer) => ({ player: { id, name: id }, answer })
const rows = [row("anna", "FIX"), row("ben", "MAYBE"), row("cleo", "OPEN"), row("dan", "OUT"), row("eve", "level:sub")]

const variant: VariantData = {
  id: "v1",
  name: "Variante 1",
  note: null,
  votes: [],
  // Notes belong to the player in this variant, wherever they currently are
  playerNotes: { dan: "nur falls", ben: "kann erst ab MD2" },
  lineups: [
    { id: "l1", name: "B2 eSports", note: null, playerIds: ["anna", "dan"] },
    { id: "l2", name: "B2 Rising", note: null, playerIds: [] },
  ],
}

describe("variantBoard", () => {
  it("puts everyone who can be placed and is not in a lineup into the pool, with their notes", () => {
    expect(variantBoard(variant, rows).pool.map((r) => [r.player.id, r.note])).toEqual([
      ["ben", "kann erst ab MD2"],
      ["cleo", null],
      ["eve", null],
    ])
  })

  it("lists the players of each lineup and flags those who are no longer in", () => {
    const board = variantBoard(variant, rows)
    expect(board.lineups[0].players.map((p) => [p.player.id, p.out, p.note])).toEqual([
      ["anna", false, null],
      ["dan", true, "nur falls"],
    ])
    expect(board.outCount).toBe(1)
  })

  it("leaves out players who are not on the availability list any more", () => {
    const board = variantBoard(variant, rows.filter((r) => r.player.id !== "anna"))
    expect(board.lineups[0].players.map((p) => p.player.id)).toEqual(["dan"])
  })
})

describe("nextVariantName", () => {
  it("numbers new variants", () => {
    expect(nextVariantName([])).toBe("Variante 1")
    expect(nextVariantName(["Variante 1", "Bodiis-Idee"])).toBe("Variante 3")
  })

  it("marks a copy and keeps the name unique", () => {
    expect(nextVariantName(["Variante 1"], "Variante 1")).toBe("Variante 1 (Kopie)")
    expect(nextVariantName(["Variante 1", "Variante 1 (Kopie)"], "Variante 1")).toBe("Variante 1 (Kopie 2)")
  })
})

describe("applyAction", () => {
  const ids = (v: VariantData) => v.lineups.map((l) => l.playerIds)

  it("moves a player into a lineup, out of the one they were in", () => {
    const [next] = applyAction([variant], { type: "placePlayer", variantId: "v1", playerId: "anna", lineupId: "l2" })
    expect(ids(next)).toEqual([["dan"], ["anna"]])
  })

  it("keeps the player's note when moving them, also back into the pool", () => {
    const [moved] = applyAction([variant], { type: "placePlayer", variantId: "v1", playerId: "dan", lineupId: "l2" })
    expect(moved.playerNotes.dan).toBe("nur falls")
    const [removed] = applyAction([variant], { type: "placePlayer", variantId: "v1", playerId: "dan", lineupId: null })
    expect(ids(removed)).toEqual([["anna"], []])
    expect(variantBoard(removed, rows.map((r) => (r.player.id === "dan" ? row("dan", "FIX") : r))).pool.find((r) => r.player.id === "dan")?.note).toBe("nur falls")
  })

  it("keeps the notes of a removed lineup's players", () => {
    const [next] = applyAction([variant], { type: "deleteLineup", lineupId: "l1" })
    expect(next.playerNotes.dan).toBe("nur falls")
  })

  it("sets and clears a player's note", () => {
    const [noted] = applyAction([variant], { type: "notePlayer", variantId: "v1", playerId: "cleo", note: "Kapitän" })
    expect(noted.playerNotes.cleo).toBe("Kapitän")
    const [cleared] = applyAction([variant], { type: "notePlayer", variantId: "v1", playerId: "dan", note: null })
    expect(cleared.playerNotes).toEqual({ ben: "kann erst ab MD2" })
  })

  it("leaves other variants untouched", () => {
    const other = { ...variant, id: "v2" }
    const next = applyAction([variant, other], { type: "placePlayer", variantId: "v1", playerId: "ben", lineupId: "l1" })
    expect(next[1]).toBe(other)
  })
})

describe("defaultLineupNames", () => {
  it("names the lineups of a new variant by how many there are", () => {
    expect(defaultLineupNames(2)).toEqual(["B2 eSports", "B2 Academy"])
    expect(defaultLineupNames(3)).toEqual(["B2 eSports", "B2 Rising", "B2 Academy"])
    expect(defaultLineupNames(4)).toEqual(["B2 eSports", "B2 Rising", "B2 Academy", "B2 Horizon"])
  })

  it("numbers further lineups", () => {
    expect(defaultLineupNames(1)).toEqual(["B2 eSports"])
    expect(defaultLineupNames(5).at(-1)).toBe("Lineup 5")
  })
})

describe("adoptionPlan", () => {
  it("turns the lineups that have players into the lineups of the tournament", () => {
    const plan = adoptionPlan(variant, rows)
    expect(plan.lineups).toEqual([{ name: "B2 eSports", playerIds: ["anna", "dan"] }])
    expect(plan.empty).toEqual(["B2 Rising"])
  })

  it("counts who is taken along although no longer in, and who stays without a lineup", () => {
    const plan = adoptionPlan(variant, rows)
    expect(plan.outCount).toBe(1)
    expect(plan.unplaced).toBe(3)
  })

  it("takes only players who are still on the availability list", () => {
    const plan = adoptionPlan(variant, rows.filter((r) => r.player.id !== "anna"))
    expect(plan.lineups).toEqual([{ name: "B2 eSports", playerIds: ["dan"] }])
  })

  it("has nothing to adopt when no lineup has players", () => {
    expect(adoptionPlan({ ...variant, lineups: [{ id: "l2", name: "B2 Rising", note: null, playerIds: [] }] }, rows).lineups).toEqual([])
  })
})
