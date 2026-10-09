import { describe, expect, it } from "vitest"
import { roundPlacements, roundScore } from "./round-score"

// A round given as the finishing order: "u" is one of us, "o" an opponent, a trailing "x" marks a DNF
function results(order: string) {
  return order.split(" ").map((r) => ({ isOurTeam: r[0] === "u", dnf: r.endsWith("x") }))
}

describe("roundScore", () => {
  it("gives the first place as many points as there are players, down to one for the last", () => {
    expect(roundScore(results("u o o u"))).toMatchObject({ ours: 5, theirs: 5 })
    expect(roundScore(results("u u o o"))).toMatchObject({ ours: 7, theirs: 3 })
  })

  it("is won by the team with more points", () => {
    expect(roundScore(results("u u o o"))?.outcome).toBe("W")
    expect(roundScore(results("o o u u"))?.outcome).toBe("L")
    expect(roundScore(results("u o o u"))?.outcome).toBe("D")
  })

  it("gives no points for a DNF", () => {
    // B2 vs Onyx White, 4v4 round 6: without the DNF this would be 18–18
    expect(roundScore(results("o u o u u o u ox"))).toEqual({ ours: 18, theirs: 17, outcome: "W" })
  })

  it("gives no points to any of several DNFs", () => {
    expect(roundScore(results("o u o u u u ox ox"))).toEqual({ ours: 19, theirs: 14, outcome: "W" })
  })

  it("turns a draw into a loss when our last player does not finish", () => {
    expect(roundScore(results("u o o ux"))).toEqual({ ours: 4, theirs: 5, outcome: "L" })
  })

  it("has no score while one of the teams is missing", () => {
    expect(roundScore([])).toBeNull()
    expect(roundScore(results("u u"))).toBeNull()
  })
})

describe("roundPlacements", () => {
  it("numbers the players in finishing order", () => {
    expect(roundPlacements(results("u o o u"))).toEqual([1, 2, 3, 4])
  })

  it("puts every DNF on the last place, however many there are", () => {
    expect(roundPlacements(results("o u o u u u ox ux"))).toEqual([1, 2, 3, 4, 5, 6, 8, 8])
  })
})
