import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseSeedingSheet } from "./seeding-sheet"

// The master sheet of EMC S7 as Google exports its tabs "Seeding" and "Leagues"
const seeding = readFileSync(new URL("./fixtures/emc-s7-seeding.csv", import.meta.url), "utf8")
const leagues = readFileSync(new URL("./fixtures/emc-s7-leagues.csv", import.meta.url), "utf8")

describe("the seeding master sheet", () => {
  const sheet = parseSeedingSheet(seeding, leagues)
  const team = (name: string) => sheet.teams.find((t) => t.name === name)!

  it("read the maps by name and every team", () => {
    expect(sheet.maps).toEqual(["Bernage", "Incendiary"])
    expect(sheet.teams).toHaveLength(57)
  })

  it("read a team's players per map with their Trackmania account and points", () => {
    const academy = team("B2 Academy")
    expect(academy.maps[0]).toHaveLength(10)
    expect(academy.maps[0]).toContainEqual({ name: "crypii", tmId: "81909621-cd53-43aa-82bb-238fb9bdeb88", points: 463 })
    expect(academy.maps[1].filter((p) => p.points > 0).map((p) => [p.name, p.points])).toEqual([["BeNNy_TM", 380], ["ParZival_TM", 386], ["SurvTM", 276], ["s0nity", 196]])
  })

  it("read rank and total from the ranking and the league with its group", () => {
    expect(team("B2 Academy")).toMatchObject({ rank: 19, total: 2202, league: "League 4 · Group H" })
    // Written "B2 Esports" in the leagues, placed there without seeding points
    expect(team("B2 eSports")).toMatchObject({ rank: 46, total: 0, league: "League 2 · Group D" })
    expect(team("Molotov Gaming")).toMatchObject({ rank: 1, total: 3482, league: "League 1 · Group A" })
  })

  it("leave the league out where the tab is not given", () => {
    expect(parseSeedingSheet(seeding).teams[0].league).toBeNull()
  })
})
