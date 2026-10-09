import { describe, expect, it } from "vitest"
import { entryPositions, entryState } from "./round-entry"

// All examples are 2v2: four places, our two players typed in
describe("entryState", () => {
  it("scores a round once every player has a placement", () => {
    expect(entryState([1, 2], 0, 2)).toEqual({ kind: "done", ours: 7, theirs: 3, outcome: "W" })
  })

  it("is empty before anything is typed and incomplete until everyone has an entry", () => {
    expect(entryState([undefined, undefined], 0, 2)).toEqual({ kind: "empty" })
    expect(entryState([1, undefined], 0, 2)).toEqual({ kind: "incomplete" })
    expect(entryState([undefined, undefined], 1, 2)).toEqual({ kind: "incomplete" })
  })

  it("gives our player no points for a DNF", () => {
    expect(entryState([1, "dnf"], 0, 2)).toEqual({ kind: "done", ours: 4, theirs: 5, outcome: "L" })
  })

  it("gives the opponents no points for their DNFs", () => {
    // Places 2 and 3 are a 5:5 draw unless the last opponent did not finish
    expect(entryState([2, 3], 0, 2)).toMatchObject({ ours: 5, theirs: 5, outcome: "D" })
    expect(entryState([2, 3], 1, 2)).toEqual({ kind: "done", ours: 5, theirs: 4, outcome: "W" })
  })

  it("rejects a placement used twice", () => {
    expect(entryState([2, 2], 0, 2)).toEqual({ kind: "invalid", bad: new Set([2]) })
  })

  it("rejects a placement no finisher can have because of the DNFs", () => {
    expect(entryState([1, 4], 1, 2)).toEqual({ kind: "invalid", bad: new Set([4]) })
    expect(entryState([3, "dnf"], 1, 2)).toEqual({ kind: "invalid", bad: new Set([3]) })
  })
})

describe("entryPositions", () => {
  it("keeps typed placements and puts our DNFs right behind the finishers", () => {
    expect(entryPositions([1, "dnf"], 1, 2)).toEqual({ positions: [1, 3], dnf: [false, true] })
    expect(entryPositions(["dnf", "dnf"], 0, 2)).toEqual({ positions: [3, 4], dnf: [true, true] })
  })
})
