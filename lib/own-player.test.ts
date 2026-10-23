import { describe, expect, it } from "vitest"
import { isOwnPlayer } from "./own-player"

describe("the signed-in player's own rows", () => {
  const own = { id: "p1", tmId: "tm-1" }
  it("are found by the player or by the Trackmania account", () => {
    expect(isOwnPlayer(own, { id: "p1" })).toBe(true)
    expect(isOwnPlayer(own, { playerId: "p1" })).toBe(true)
    expect(isOwnPlayer(own, { tmId: "tm-1" })).toBe(true)
    expect(isOwnPlayer(own, { id: "p2", tmId: "tm-2" })).toBe(false)
    // Trackmania accounts are written in either case
    expect(isOwnPlayer({ id: "p1", tmId: "ab-CD" }, { tmId: "AB-cd" })).toBe(true)
  })
  it("are none without a linked player or without anything to compare", () => {
    expect(isOwnPlayer(null, { id: "p1" })).toBe(false)
    expect(isOwnPlayer({ id: "p1", tmId: null }, { tmId: null })).toBe(false)
    expect(isOwnPlayer(own, {})).toBe(false)
  })
})
