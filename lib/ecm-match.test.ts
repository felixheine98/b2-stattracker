import { describe, expect, it } from "vitest"
import { suggestEcmTarget } from "./ecm-match"
import { decodeEcmFragment } from "./ecm"

const lineup = (name: string, matches: Array<[string, string | null]>) => ({
  id: name,
  name,
  matches: matches.map(([id, opponent]) => ({ id, opponent })),
})

// Newest tournament first
const tournaments = [
  { id: "s2", tournamentLineups: [lineup("B2 eSports", []), lineup("B2 Rising", [["s2-md1", "Onyx White"]])] },
  { id: "s1", tournamentLineups: [lineup("B2 Rising", [["s1-md1", "eSport Line"], ["s1-po", "eSport Line"]])] },
]

describe("suggestEcmTarget", () => {
  it("finds our lineup among the two teams, whatever the order and spelling", () => {
    expect(suggestEcmTarget(["Onyx White", "b2 rising"], tournaments)).toEqual({
      tournamentId: "s2",
      lineupId: "B2 Rising",
      opponent: "Onyx White",
      matchIds: ["s2-md1"],
    })
  })

  it("prefers the tournament in which the lineup already plays that opponent", () => {
    expect(suggestEcmTarget(["B2 Rising", "eSport Line"], tournaments)).toEqual({
      tournamentId: "s1",
      lineupId: "B2 Rising",
      opponent: "eSport Line",
      matchIds: ["s1-md1", "s1-po"],
    })
  })

  it("suggests the newest tournament of the lineup when the match does not exist yet", () => {
    expect(suggestEcmTarget(["Team Yahoo", "B2 Rising"], tournaments)).toEqual({
      tournamentId: "s2",
      lineupId: "B2 Rising",
      opponent: "Team Yahoo",
      matchIds: [],
    })
  })

  it("suggests nothing when neither team is one of our lineups", () => {
    expect(suggestEcmTarget(["Onyx White", "eSport Line"], tournaments)).toBeNull()
  })
})

describe("decodeEcmFragment", () => {
  it("reads back what the bookmarklet put into the address", () => {
    const json = JSON.stringify({ ecm: 1, teams: [{ name: "Grün-Weiß", players: [] }], sets: [] })
    const fragment = "#" + Buffer.from(json, "utf8").toString("base64url")
    expect(decodeEcmFragment(fragment)).toBe(json)
  })

  it("is null for anything else", () => {
    expect(decodeEcmFragment("")).toBeNull()
    expect(decodeEcmFragment("#%%%")).toBeNull()
  })
})
