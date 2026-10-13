import { describe, expect, it } from "vitest"
import { addGap, emptyPace, paceMs, pacePct, paceTooltip, roundBest } from "./pace"

describe("roundBest", () => {
  it("is the fastest time of the round over both teams", () => {
    expect(roundBest([{ timeMs: 61000 }, { timeMs: 60000 }, { timeMs: 62000 }])).toBe(60000)
  })

  it("ignores results without a time and players who did not finish", () => {
    expect(roundBest([{ timeMs: 59000, dnf: true }, { timeMs: null }, { timeMs: 60000 }])).toBe(60000)
  })

  it("is null when nobody has a time", () => {
    expect(roundBest([{ dnf: true }, { timeMs: null }])).toBeNull()
  })
})

describe("pace", () => {
  it("averages the gap to the fastest time in percent and in milliseconds", () => {
    const sum = emptyPace()
    addGap(sum, 61200, 60000) // +2 %, +1200 ms
    addGap(sum, 50000, 50000) // fastest of the round
    expect(sum.rounds).toBe(2)
    expect(pacePct(sum)).toBeCloseTo(1)
    expect(paceMs(sum)).toBeCloseTo(600)
  })

  it("is null without a timed round", () => {
    expect(pacePct(emptyPace())).toBeNull()
    expect(paceMs(emptyPace())).toBeNull()
  })
})

describe("paceTooltip", () => {
  it("gives the pace as the average gap in seconds", () => {
    expect(paceTooltip(1234.4)).toBe("Avg gap +1.234 s per round")
  })

  it("is missing without a timed round", () => {
    expect(paceTooltip(null)).toBeUndefined()
  })
})
