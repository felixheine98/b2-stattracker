import { describe, expect, it } from "vitest"
import { search, type SearchEntry } from "./search"

function entry(kind: SearchEntry["kind"], title: string, extra: Partial<SearchEntry> = {}): SearchEntry {
  return { kind, id: `${kind}-${title}`, title, href: `/${kind}/${title}`, ...extra }
}

const titles = (entries: SearchEntry[], query: string) =>
  search(entries, query).map((g) => [g.kind, g.hits.map((h) => h.entry.title)])

describe("search", () => {
  it("finds nothing for an empty query", () => {
    expect(search([entry("player", "Anna")], "  ")).toEqual([])
  })

  it("finds entries whose name contains the text, whatever the case", () => {
    expect(titles([entry("player", "Anna"), entry("player", "Ben")], "NN")).toEqual([["player", ["Anna"]]])
  })

  it("groups the hits by kind, in a fixed order", () => {
    const entries = [entry("match", "Alpha vs Onyx", { terms: ["Onyx", "Alpha"] }), entry("tournament", "Onyx Cup"), entry("team", "Onyx"), entry("player", "Onyxia")]
    expect(search(entries, "onyx").map((g) => g.kind)).toEqual(["player", "team", "tournament", "match"])
  })

  it("puts names starting with the text first, then the others alphabetically", () => {
    expect(titles([entry("player", "Joanna"), entry("player", "Anton"), entry("player", "Anna")], "an")).toEqual([
      ["player", ["Anna", "Anton", "Joanna"]],
    ])
  })

  it("finds an entry under a former name or alias and says which one", () => {
    const [group] = search([entry("player", "Felix", { aliases: ["FlxTM"] })], "flx")
    expect(group.hits[0]).toMatchObject({ entry: { title: "Felix" }, via: "FlxTM" })
  })

  it("names no alias when the current name matches as well", () => {
    const [group] = search([entry("player", "Felix", { aliases: ["Felix_TM"] })], "felix")
    expect(group.hits[0].via).toBeUndefined()
  })

  it("puts hits by current name before hits by a former name", () => {
    expect(titles([entry("player", "Zed", { aliases: ["Anna2"] }), entry("player", "Joanna")], "anna")).toEqual([["player", ["Joanna", "Zed"]]])
  })

  it("puts archived and unconfirmed entries last in their group", () => {
    expect(titles([entry("team", "Onyx Old", { marker: "archived" }), entry("team", "Team Onyx")], "onyx")).toEqual([
      ["team", ["Team Onyx", "Onyx Old"]],
    ])
  })

  it("requires every word of the query", () => {
    expect(titles([entry("team", "Onyx White"), entry("team", "Onyx Black")], "onyx white")).toEqual([["team", ["Onyx White"]]])
  })

  it("finds a match when every word fits one of its terms: opponent, lineup or tournament", () => {
    const entries = [
      entry("match", "Alpha vs Onyx", { terms: ["Onyx", "Alpha", "Vertigo S1"] }),
      entry("match", "Bravo vs Onyx", { terms: ["Onyx", "Bravo", "Vertigo S1"] }),
      entry("match", "Alpha vs OCD", { terms: ["OCD", "Alpha", "Winter Cup"] }),
    ]
    expect(titles(entries, "alpha vertigo")).toEqual([["match", ["Alpha vs Onyx"]]])
    expect(titles(entries, "onyx")).toEqual([["match", ["Alpha vs Onyx", "Bravo vs Onyx"]]])
  })

  it("lists matches newest first, those without a date last", () => {
    const entries = [
      entry("match", "old", { terms: ["Onyx"], date: "2026-06-01" }),
      entry("match", "undated", { terms: ["Onyx"], date: null }),
      entry("match", "new", { terms: ["Onyx"], date: "2026-07-01" }),
    ]
    expect(titles(entries, "onyx")).toEqual([["match", ["new", "old", "undated"]]])
  })

  it("limits the hits of a group and reports how many there are", () => {
    const entries = ["a", "b", "c"].map((n) => entry("player", `Anna ${n}`))
    const [group] = search(entries, "anna", 2)
    expect(group.hits).toHaveLength(2)
    expect(group.total).toBe(3)
  })
})
