import { describe, expect, it } from "vitest"
import { repairEcmSet, type EcmSet } from "./ecm"

// A round as "name time" entries in finishing order
const round = (...entries: string[]) => entries.map((e) => ({ p: e.split(" ")[0], t: e.split(" ")[1] }))
const set = (...rounds: ReturnType<typeof round>[]): EcmSet => ({ label: "Set 1", map: "Map", rounds })

const regular = round("anna 1:00.000", "opp1 1:01.000", "ben 1:02.000", "opp2 1:03.000")

describe("repairEcmSet", () => {
  it("leaves a set alone when every round has the same number of players", () => {
    const input = set(regular, round("opp1 1:00.000", "anna 1:01.000", "opp2 1:02.000", "ben DNF"))
    expect(repairEcmSet(input)).toEqual({ set: input, dropped: [], added: [] })
  })

  it("drops an extra player who joined a round by mistake and never finished", () => {
    const input = set(regular, [...regular, { p: "sub", t: "DNF" }], regular)
    expect(repairEcmSet(input)).toEqual({
      set: set(regular, regular, regular),
      dropped: [{ round: 2, player: "sub" }],
      added: [],
    })
  })

  it("keeps the DNF of a regular player of the set", () => {
    // ben finishes in the other rounds, so his DNF is a real result and the round stays as it is
    const withSub = round("anna 1:00.000", "opp1 1:01.000", "opp2 1:03.000", "cleo 1:04.000", "ben DNF")
    const input = set(regular, withSub, regular)
    expect(repairEcmSet(input)).toEqual({ set: input, dropped: [], added: [] })
  })

  it("does not touch an extra player who finished", () => {
    const input = set(regular, [...regular, { p: "sub", t: "1:09.000" }], regular)
    expect(repairEcmSet(input)).toEqual({ set: input, dropped: [], added: [] })
  })

  it("adds a player missing from a single round as a DNF on the last place", () => {
    const input = set(regular, regular.filter((e) => e.p !== "ben"), regular)
    expect(repairEcmSet(input)).toEqual({
      set: set(regular, [...regular.filter((e) => e.p !== "ben"), { p: "ben", t: "DNF" }], regular),
      dropped: [],
      added: [{ round: 2, player: "ben" }],
    })
  })

  it("does not guess when it is unclear who is missing", () => {
    // cleo replaced ben from round 2 on, so in the short round either of them could be the missing one
    const withCleo = round("anna 1:00.000", "opp1 1:01.000", "cleo 1:02.000", "opp2 1:03.000")
    const input = set(regular, withCleo, withCleo.filter((e) => e.p !== "anna" && e.p !== "cleo"), withCleo)
    expect(repairEcmSet(input)).toEqual({ set: input, dropped: [], added: [] })
  })
})
