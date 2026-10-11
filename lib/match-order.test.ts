import { describe, expect, it } from "vitest"
import { matchTag, nextMatchNumber, sortMatches } from "./match-order"

const m = (id: string, number: number | null, extra: { date?: string | null; createdAt?: string } = {}) => ({
  id,
  number,
  date: extra.date ?? null,
  createdAt: extra.createdAt ?? "2026-01-01T00:00:00Z",
})

describe("sortMatches", () => {
  it("puts numbered matches in the order of their numbers", () => {
    expect(sortMatches([m("c", 3), m("a", 1), m("b", 2)]).map((x) => x.id)).toEqual(["a", "b", "c"])
  })

  it("puts matches without a number after the numbered ones, earliest first", () => {
    const sorted = sortMatches([
      m("late", null, { date: "2026-06-21" }),
      m("two", 2),
      m("early", null, { date: "2026-06-14" }),
      m("one", 1),
    ])
    expect(sorted.map((x) => x.id)).toEqual(["one", "two", "early", "late"])
  })

  it("falls back to when a match was added", () => {
    const sorted = sortMatches([m("second", null, { createdAt: "2026-01-02T00:00:00Z" }), m("first", null, { createdAt: "2026-01-01T00:00:00Z" })])
    expect(sorted.map((x) => x.id)).toEqual(["first", "second"])
  })

  it("keeps matches with the same number in the order they were added", () => {
    const sorted = sortMatches([m("b", 1, { createdAt: "2026-01-02T00:00:00Z" }), m("a", 1, { createdAt: "2026-01-01T00:00:00Z" })])
    expect(sorted.map((x) => x.id)).toEqual(["a", "b"])
  })

  it("leaves the given list untouched", () => {
    const list = [m("b", 2), m("a", 1)]
    sortMatches(list)
    expect(list.map((x) => x.id)).toEqual(["b", "a"])
  })
})

describe("nextMatchNumber", () => {
  it("is the number after the highest one", () => {
    expect(nextMatchNumber([m("a", 1), m("b", 4)])).toBe(5)
  })

  it("starts at 1", () => {
    expect(nextMatchNumber([])).toBe(1)
  })

  it("counts matches without a number, so older ones need not be numbered first", () => {
    expect(nextMatchNumber([m("a", null), m("b", null), m("c", null)])).toBe(4)
    expect(nextMatchNumber([m("a", null), m("b", 1)])).toBe(3)
  })
})

describe("matchTag", () => {
  it("joins number and name", () => {
    expect(matchTag({ number: 2, label: "Upper Final" })).toBe("#2 · Upper Final")
  })

  it("works with only one of the two", () => {
    expect(matchTag({ number: 2, label: null })).toBe("#2")
    expect(matchTag({ number: null, label: " Lower Bracket Final " })).toBe("Lower Bracket Final")
  })

  it("is empty without both", () => {
    expect(matchTag({ number: null, label: "" })).toBe("")
    expect(matchTag({})).toBe("")
  })
})
