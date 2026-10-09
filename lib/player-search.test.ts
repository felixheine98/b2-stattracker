import { describe, expect, it } from "vitest"
import { searchPlayers } from "./player-search"

const players = ["Boris_TM", "BeNNy_TM", "Agent.TM", "Jan_08", "NismoTM"].map((name) => ({ id: name, name }))
const names = (query: string) => searchPlayers(players, query).map((p) => p.name)

describe("searchPlayers", () => {
  it("finds players by any part of the name, whatever the case", () => {
    expect(names("nny")).toEqual(["BeNNy_TM"])
    expect(names("JAN")).toEqual(["Jan_08"])
  })

  it("lists names starting with the text before those merely containing it", () => {
    expect(names("b")).toEqual(["BeNNy_TM", "Boris_TM"])
    expect(names("n")).toEqual(["NismoTM", "Agent.TM", "BeNNy_TM", "Jan_08"])
  })

  it("finds nothing for an empty search", () => {
    expect(names("  ")).toEqual([])
  })

  it("also finds a player by a name they had before", () => {
    const renamed = [...players, { id: "rain", name: "raiin.wav", allNames: ["Raiiinnnn", "raiin.wav"] }]
    expect(searchPlayers(renamed, "raiii").map((p) => p.name)).toEqual(["raiin.wav"])
  })
})
