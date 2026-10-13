import { describe, expect, it } from "vitest"
import { checkImport, dateCheck, dateHint, importNoteLine, opponentHints, ownHints, teamNameHints, withImportNote } from "./import-check"

const driver = (tmId: string, name = tmId) => ({ tmId, name })

describe("opponentHints", () => {
  const opponent = { name: "Team X", knownTmIds: ["x1", "x2", "x3"] }
  const others = [{ name: "Team Y", knownTmIds: ["y1", "y2"] }]

  it("says nothing when a driver known for the opponent is among the foreign drivers", () => {
    expect(opponentHints([driver("x1"), driver("new")], opponent, others)).toEqual([])
  })

  it("points out that none of the opponent's known drivers is in the import", () => {
    expect(opponentHints([driver("a"), driver("b")], opponent, others)).toEqual([
      { text: "None of the drivers known for Team X is in this import.", short: "no known driver of Team X" },
    ])
  })

  it("stays silent about an opponent nobody is known for", () => {
    expect(opponentHints([driver("a")], { name: "Newcomers", knownTmIds: [] }, others)).toEqual([])
  })

  it("names the other opponent of the tournament a foreign driver is known for", () => {
    expect(opponentHints([driver("x1"), driver("Y1", "Yann")], opponent, others)).toEqual([
      { text: "Yann is known as a driver of Team Y.", short: "Yann drives for Team Y" },
    ])
  })

  it("does not blame a driver who is known for the entered opponent as well", () => {
    expect(opponentHints([driver("x1")], opponent, [{ name: "Mix", knownTmIds: ["x1"] }])).toEqual([])
  })

  it("counts only real accounts as known, not the placeholders of imports without account IDs", () => {
    const real = "0a1b2c3d-1111-2222-3333-444455556666"
    const byName = { name: "Team X", knownTmIds: ["opponent-1", "ecm-Speedy", "unknown-5f0c"] }
    expect(opponentHints([driver("a")], byName, [])).toEqual([])
    expect(opponentHints([driver("a")], { name: "Team X", knownTmIds: ["opponent-1", real] }, [])).toEqual([
      { text: "None of the drivers known for Team X is in this import.", short: "no known driver of Team X" },
    ])
    expect(opponentHints([driver("opponent-1", "Anon")], null, [{ name: "Team Y", knownTmIds: ["opponent-1"] }])).toEqual([])
    expect(opponentHints([driver("opponent-1", "Anon")], { name: "Team X", knownTmIds: [] }, [{ name: "Team Y", knownTmIds: ["opponent-1"] }])).toEqual([])
  })

  it("has nothing to compare without an opponent, as in a seeding match", () => {
    expect(opponentHints([driver("y1", "Yann")], null, others)).toEqual([])
  })
})

describe("ownHints", () => {
  const lineup = { name: "B2 eSports", tmIds: ["e1", "e2", "e3"] }
  const otherLineups = [{ name: "B2 Academy", tmIds: ["a1", "a2"] }]

  it("says nothing when our drivers are in the roster of the lineup", () => {
    expect(ownHints([driver("E1"), driver("e2")], [driver("x1")], lineup, otherLineups)).toEqual([])
  })

  it("points out a driver of ours who is not in the roster of the lineup", () => {
    expect(ownHints([driver("e1"), driver("s1", "Sub")], [], lineup, otherLineups)).toEqual([
      { text: "Sub is not in the roster of B2 eSports.", short: "Sub not in the roster" },
    ])
  })

  it("names the other lineup of ours the driver is in the roster of", () => {
    expect(ownHints([driver("e1"), driver("a1", "Ari")], [], lineup, otherLineups)).toEqual([
      { text: "Ari is in the roster of B2 Academy, not of B2 eSports.", short: "Ari is in the roster of B2 Academy" },
    ])
  })

  it("points out a driver of the roster who is counted as an opponent", () => {
    expect(ownHints([driver("e1")], [driver("E3", "Eve"), driver("x1")], lineup, otherLineups)).toEqual([
      { text: "Eve is in the roster of B2 eSports but counted as an opponent.", short: "Eve counted as an opponent" },
    ])
  })
})

describe("dateCheck", () => {
  const at = (iso: string) => Date.parse(iso) / 1000

  it("agrees when the first round was driven on the day of the match", () => {
    expect(dateCheck(at("2026-10-13T17:30:00Z"), "2026-10-13")).toEqual({ importDay: "2026-10-13", matchDay: "2026-10-13", differs: false })
  })

  it("takes the day in German local time, not in UTC", () => {
    // 00:30 in Germany on the 14th is still the 13th in UTC
    expect(dateCheck(at("2026-10-13T22:30:00Z"), "2026-10-13")).toEqual({ importDay: "2026-10-14", matchDay: "2026-10-13", differs: true })
  })

  it("has a day to offer for a match without a date, which is no deviation", () => {
    expect(dateCheck(at("2026-01-10T19:00:00Z"), null)).toEqual({ importDay: "2026-01-10", matchDay: null, differs: false })
  })

  it("knows nothing without a time of the rounds", () => {
    expect(dateCheck(0, "2026-10-13")).toBeNull()
    expect(dateCheck(null, "2026-10-13")).toBeNull()
  })

  it("words the deviation with both days", () => {
    expect(dateHint({ importDay: "2026-10-14", matchDay: "2026-10-13" })).toEqual({
      text: "The rounds were driven on 14.10.2026, the match is dated 13.10.2026.",
      short: "rounds of 14.10.2026, match dated 13.10.2026",
    })
  })
})

describe("teamNameHints", () => {
  const opponent = { name: "Team X", aliases: ["TX Racing"] }

  it("says nothing when both names on the eCM page fit, whatever the spelling", () => {
    expect(teamNameHints({ own: "b2-esports", opponent: "TEAM  X" }, "B2 eSports", opponent)).toEqual([])
    expect(teamNameHints({ own: "B2 eSports", opponent: "tx racing" }, "B2 eSports", opponent)).toEqual([])
  })

  it("points out an opponent on the eCM page that is not the entered one", () => {
    expect(teamNameHints({ own: "B2 eSports", opponent: "Team Y" }, "B2 eSports", opponent)).toEqual([
      { text: "The eCM page shows Team Y as the opponent, the match is entered against Team X.", short: "eCM opponent Team Y instead of Team X" },
    ])
  })

  it("points out a team of ours on the eCM page that is not the lineup of the match", () => {
    expect(teamNameHints({ own: "B2 Academy", opponent: "Team X" }, "B2 eSports", opponent)).toEqual([
      { text: "The eCM page shows B2 Academy as our team, the match belongs to B2 eSports.", short: "eCM team B2 Academy instead of B2 eSports" },
    ])
  })

  it("does not compare the opponent of a match that has none", () => {
    expect(teamNameHints({ own: "B2 eSports", opponent: "Team Y" }, "B2 eSports", null)).toEqual([])
  })
})

describe("note of an import despite hints", () => {
  const hints = [{ text: "long", short: "no known driver of Team X" }, { text: "long", short: "Sub not in the roster" }]
  const line = "Import 13.10.2026 (Felix) despite warnings: no known driver of Team X; Sub not in the roster."

  it("names day, importer and the hints in short", () => {
    expect(importNoteLine("2026-10-13", "Felix", hints)).toBe(line)
    expect(importNoteLine("2026-10-13", "Felix", [])).toBeNull()
  })

  it("appends the line to the notes written by hand", () => {
    expect(withImportNote(null, line)).toBe(line)
    expect(withImportNote("Upper final\nbo3", line)).toBe(`Upper final\nbo3\n${line}`)
  })

  it("replaces the line of the import before", () => {
    const next = "Import 14.10.2026 (Boris) despite warnings: Ari is in the roster of B2 Academy."
    expect(withImportNote(`Upper final\n${line}`, next)).toBe(`Upper final\n${next}`)
  })

  it("removes the line after an import without hints and leaves the rest alone", () => {
    expect(withImportNote(`Upper final\n${line}`, null)).toBe("Upper final")
    expect(withImportNote(line, null)).toBeNull()
    expect(withImportNote("Upper final", null)).toBe("Upper final")
  })
})

describe("checkImport", () => {
  const context = {
    lineup: { name: "B2 eSports", tmIds: ["e1", "e2"] },
    otherLineups: [{ name: "B2 Academy", tmIds: ["a1"] }],
    opponent: { name: "Team X", aliases: [], knownTmIds: ["x1", "x2"] },
    otherOpponents: [{ name: "Team Y", knownTmIds: ["y1"] }],
    matchDay: "2026-10-13",
  }
  const start = Date.parse("2026-10-13T17:30:00Z") / 1000

  it("has nothing to say about a CSV that fits the match", () => {
    expect(checkImport({ ours: [driver("e1"), driver("e2")], foreign: [driver("x1"), driver("x2")], firstRoundTime: start }, context)).toEqual({
      hints: [],
      date: { importDay: "2026-10-13", matchDay: "2026-10-13", differs: false },
    })
  })

  it("collects the hints on our lineup and on the opponent of a CSV from another match", () => {
    const result = checkImport({ ours: [driver("a1", "Ari")], foreign: [driver("y1", "Yann")], firstRoundTime: null }, context)
    expect(result.hints.map((h) => h.short)).toEqual(["Ari is in the roster of B2 Academy", "no known driver of Team X", "Yann drives for Team Y"])
    expect(result.date).toBeNull()
  })

  it("compares the team names of an eCM page and leaves the opponent's drivers alone", () => {
    const result = checkImport({ ours: [driver("e1")], foreign: [], firstRoundTime: null, teams: { own: "B2 eSports", opponent: "Team Y" } }, context)
    expect(result.hints.map((h) => h.short)).toEqual(["eCM opponent Team Y instead of Team X"])
  })

  it("still notices a driver of the roster on the other team of an eCM page", () => {
    const result = checkImport({ ours: [driver("e1")], foreign: [driver("e2", "Eve")], firstRoundTime: null, teams: { own: "B2 eSports", opponent: "Team X" } }, context)
    expect(result.hints.map((h) => h.short)).toEqual(["Eve counted as an opponent"])
  })
})
