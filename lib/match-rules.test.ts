import { describe, expect, it } from "vitest"
import { checkRuleSet, closingHints, lineupPoints, matchPoints, matchReport, type MatchFlow, ruleChangeImpact, type RuleSet, ruleSetFor, subMatchState } from "./match-rules"

// A 1v1 round each: ours first is a win, theirs first a loss; a 2v2 with places 1 and 4
// against 2 and 3 is level (5 points each).
const win = { results: [{ isOurTeam: true }, { isOurTeam: false }] }
const loss = { results: [{ isOurTeam: false }, { isOurTeam: true }] }
const level = { results: [{ isOurTeam: true }, { isOurTeam: false }, { isOurTeam: false }, { isOurTeam: true }] }
const rounds = (order: string) => [...order].map((c) => (c === "W" ? win : c === "L" ? loss : level))

describe("subMatchState", () => {
  it("is decided once a side has the rounds to win", () => {
    expect(subMatchState(rounds("WWLWWLWLWW"), { roundsToWin: 7, maxRounds: null })).toEqual({
      won: 7, lost: 3, drawn: 0, outcome: "W", status: "decided", hint: null,
    })
  })

  it("does not count level rounds towards the target", () => {
    const state = subMatchState(rounds("WDDLDDWDDLDDWDDLDDWDDW"), { roundsToWin: 5, maxRounds: null })
    expect(state).toMatchObject({ won: 5, lost: 3, drawn: 14, outcome: "W", status: "decided", hint: null })
  })

  it("ends at the round limit and goes to whoever won more rounds", () => {
    // Vertigo S1, 4v4: 6:5 with two level rounds after 13 rounds
    const state = subMatchState(rounds("WLWLWLWLWLDDW"), { roundsToWin: 7, maxRounds: 13 })
    expect(state).toMatchObject({ won: 6, lost: 5, drawn: 2, outcome: "W", status: "decided", hint: null })
  })

  it("is a draw when the round limit is reached level", () => {
    const state = subMatchState(rounds("WLWLWLWLWLDDD"), { roundsToWin: 7, maxRounds: 13 })
    expect(state).toMatchObject({ won: 5, lost: 5, outcome: "D", status: "decided", hint: null })
  })

  it("counts an undecided sub-match for the leader and says what is missing", () => {
    const state = subMatchState(rounds("WWLWWLWLW"), { roundsToWin: 7, maxRounds: 13 })
    expect(state).toMatchObject({ won: 6, lost: 3, outcome: "W", status: "incomplete", hint: "6:3 – target 7 not reached" })
  })

  it("counts an undecided level sub-match as a draw", () => {
    const state = subMatchState(rounds("WLWLWLWLDDD"), { roundsToWin: 5, maxRounds: null })
    expect(state).toMatchObject({ outcome: "D", status: "incomplete", hint: "4:4 – target 5 not reached" })
  })

  it("reports rounds played after the sub-match was decided", () => {
    // 7CC S1: 8:3 with a target of 7
    const state = subMatchState(rounds("WWLWWLWLWWW"), { roundsToWin: 7, maxRounds: null })
    expect(state).toMatchObject({ won: 8, lost: 3, outcome: "W", status: "overplayed", hint: "8:3 – 1 round after it was decided" })
  })

  it("reports rounds beyond the round limit", () => {
    const state = subMatchState(rounds("WLWLWLWLWLDDDWW"), { roundsToWin: 7, maxRounds: 13 })
    expect(state).toMatchObject({ won: 7, lost: 5, status: "overplayed", hint: "7:5 – 2 rounds after it was decided" })
  })

  it("has no state without a round that both teams drove", () => {
    expect(subMatchState([], { roundsToWin: 7, maxRounds: null })).toMatchObject({ outcome: null, status: "empty", hint: null })
    expect(subMatchState([{ results: [{ isOurTeam: true }] }], { roundsToWin: 7, maxRounds: null })).toMatchObject({ outcome: null, status: "empty" })
  })

  it("only gives the outcome when the format has no rule", () => {
    expect(subMatchState(rounds("WWL"), null)).toEqual({ won: 2, lost: 1, drawn: 0, outcome: "W", status: "unruled", hint: null })
  })
})

// A rule set whose sub-matches are decided by a single round, so "WLD" reads as three
// sub-matches: won, lost, drawn
function ruleSet(flow: MatchFlow, count: number): RuleSet {
  return {
    formats: ["TIME_ATTACK_10", ...Array(count).fill("ROUND_3V3")],
    flow,
    formatRules: { ROUND_3V3: { roundsToWin: 1, maxRounds: 1 } },
    points: { win: 3, draw: 1, loss: 0 },
  }
}
// "-" is a sub-match without rounds
const subs = (order: string) => [...order].map((c) => ({ format: "ROUND_3V3", rounds: c === "-" ? [] : rounds(c) }))
const report = (order: string, flow: MatchFlow, count: number) => matchReport(subs(order), ruleSet(flow, count))

describe("matchReport", () => {
  it("goes to whoever won more sub-matches", () => {
    expect(report("WLWW", "ALL", 4)).toMatchObject({ won: 3, lost: 1, drawn: 0, outcome: "W", hints: [] })
    expect(report("LLWL", "ALL", 4)).toMatchObject({ outcome: "L", hints: [] })
  })

  it("leaves sub-matches without rounds out", () => {
    expect(report("-WW", "UNTIL_DECIDED", 3)).toMatchObject({ won: 2, lost: 0, outcome: "W", hints: [] })
    expect(report("---", "ALL", 3)).toMatchObject({ outcome: null })
  })

  it("carries the state of every sub-match", () => {
    const { subMatches } = matchReport(
      [{ format: "ROUND_1V1", rounds: rounds("WWL") }, { format: "ROUND_2V2", rounds: rounds("LL") }],
      { formats: ["ROUND_1V1", "ROUND_2V2"], flow: "ALL", formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null } }, points: null },
    )
    expect(subMatches.map((s) => s.status)).toEqual(["incomplete", "unruled"])
  })

  describe("when all sub-matches are played", () => {
    it("accepts a draw", () => {
      // Vertigo S1: 2:2, and 1:1 with two drawn sub-matches
      expect(report("WLLW", "ALL", 4)).toMatchObject({ outcome: "D", hints: [] })
      expect(report("WLDD", "ALL", 4)).toMatchObject({ won: 1, lost: 1, drawn: 2, outcome: "D", hints: [] })
    })

    it("reports missing sub-matches", () => {
      expect(report("LLL-", "ALL", 4)).toMatchObject({ outcome: "L", hints: ["3 of 4 sub-matches played"] })
    })

    it("reports sub-matches beyond the format sequence", () => {
      expect(report("WLWLW", "ALL", 4)).toMatchObject({ hints: ["5 sub-matches played, the format has 4"] })
    })
  })

  describe("when the match ends as soon as it is decided", () => {
    it("is finished with the majority of the sequence", () => {
      // Blitz League S1, best of three
      expect(report("WW", "UNTIL_DECIDED", 3).hints).toEqual([])
      expect(report("LWW", "UNTIL_DECIDED", 3).hints).toEqual([])
    })

    it("reports a match nobody has won yet", () => {
      expect(report("WL", "UNTIL_DECIDED", 3)).toMatchObject({ outcome: "D", hints: ["1:1 – no side has the 2 sub-matches needed"] })
    })

    it("reports sub-matches played after the decision", () => {
      expect(report("WWL", "UNTIL_DECIDED", 3)).toMatchObject({ outcome: "W", hints: ["1 sub-match played after the match was decided"] })
    })
  })

  describe("when the last sub-match is a decider", () => {
    it("is finished without the decider unless the others end level", () => {
      // MTS: 3:1 after four, the fifth only after 2:2
      expect(report("WWLW", "DECIDER", 5).hints).toEqual([])
      expect(report("LWWLW", "DECIDER", 5)).toMatchObject({ won: 3, lost: 2, outcome: "W", hints: [] })
    })

    it("reports the missing decider", () => {
      expect(report("WLLW", "DECIDER", 5)).toMatchObject({ outcome: "D", hints: ["2:2 – decider missing"] })
    })

    it("reports missing sub-matches before the decider", () => {
      expect(report("WWW", "DECIDER", 5).hints).toEqual(["3 of 4 sub-matches played"])
    })

    it("reports a decider that was not needed", () => {
      expect(report("WWLWL", "DECIDER", 5).hints).toEqual(["Decider played although the match stood 3:1"])
    })

    it("reports a match that is level after the decider", () => {
      expect(report("WLLWD", "DECIDER", 5)).toMatchObject({ outcome: "D", hints: ["2:2 – still level after the decider"] })
    })
  })

  it("follows the old rule of thumb without a rule set", () => {
    expect(matchReport(subs("WL"), null)).toMatchObject({ won: 1, lost: 1, outcome: "D", hints: [] })
    expect(matchReport(subs("WL"), null).subMatches.map((s) => s.status)).toEqual(["unruled", "unruled"])
  })
})

describe("ruleSetFor", () => {
  const comp = ruleSet("ALL", 4)
  const playoff = ruleSet("UNTIL_DECIDED", 3)

  it("uses the rule set of the competition in the group stage", () => {
    expect(ruleSetFor({ comp, playoff }, "GROUP")).toBe(comp)
  })

  it("uses the playoff rule set in the playoffs, if there is one", () => {
    expect(ruleSetFor({ comp, playoff }, "PLAYOFF")).toBe(playoff)
    expect(ruleSetFor({ comp, playoff: null }, "PLAYOFF")).toBe(comp)
  })

  it("has no rules for a seeding match or a competition without rules", () => {
    expect(ruleSetFor({ comp, playoff }, "SEEDING")).toBeNull()
    expect(ruleSetFor({ comp: null, playoff: null }, "GROUP")).toBeNull()
  })
})

describe("matchPoints", () => {
  const comp = ruleSet("ALL", 4)

  it("scores the result of a group match", () => {
    expect(matchPoints("W", comp, "GROUP")).toBe(3)
    expect(matchPoints("D", comp, "GROUP")).toBe(1)
    expect(matchPoints("L", comp, "GROUP")).toBe(0)
  })

  it("scores nothing outside the group stage, without a result or without rules", () => {
    expect(matchPoints("W", comp, "PLAYOFF")).toBeNull()
    expect(matchPoints(null, comp, "GROUP")).toBeNull()
    expect(matchPoints("W", null, "GROUP")).toBeNull()
  })
})

describe("checkRuleSet", () => {
  const valid = {
    formats: ["TIME_ATTACK_10", "ROUND_1V1", "ROUND_4V4", "ROUND_4V4"],
    flow: "ALL",
    formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null }, ROUND_4V4: { roundsToWin: 7, maxRounds: 13 } },
    points: { win: 3, draw: 1, loss: 0 },
  }

  it("accepts a rule set with a rule for every format of the sequence", () => {
    expect(checkRuleSet(valid, "comp")).toBeNull()
  })

  it("asks for the flow", () => {
    expect(checkRuleSet({ ...valid, flow: null }, "comp")).toBe("Select how a match is decided")
  })

  it("asks for the rounds to win of every format", () => {
    expect(checkRuleSet({ ...valid, formatRules: { ROUND_1V1: valid.formatRules.ROUND_1V1 } }, "comp")).toBe("Enter the rounds to win for 4v4")
    expect(checkRuleSet({ ...valid, formatRules: { ...valid.formatRules, ROUND_1V1: { roundsToWin: 0, maxRounds: null } } }, "comp")).toBe("Enter the rounds to win for 1v1")
  })

  it("rejects a round limit below the rounds to win", () => {
    expect(checkRuleSet({ ...valid, formatRules: { ...valid.formatRules, ROUND_4V4: { roundsToWin: 7, maxRounds: 6 } } }, "comp")).toBe("Max rounds for 4v4 cannot be lower than its rounds to win")
  })

  it("asks for all three point values of a competition", () => {
    expect(checkRuleSet({ ...valid, points: null }, "comp")).toBe("Enter the points for a win, a draw and a loss")
    expect(checkRuleSet({ ...valid, points: { win: 3, draw: null, loss: 0 } }, "comp")).toBe("Enter the points for a win, a draw and a loss")
  })

  it("takes no points for the playoffs", () => {
    expect(checkRuleSet({ ...valid, points: null }, "playoff")).toBeNull()
    expect(checkRuleSet(valid, "playoff")).toBe("Playoff matches score no points")
  })

  it("needs a format sequence, and two formats for a decider", () => {
    expect(checkRuleSet({ ...valid, formats: ["TIME_ATTACK_10"], formatRules: {} }, "playoff")).toBe("Select at least one format")
    expect(checkRuleSet({ ...valid, formats: ["ROUND_1V1"], flow: "DECIDER" }, "comp")).toBe("A decider needs at least two formats in the sequence")
  })
})

describe("ruleChangeImpact", () => {
  const match = (order: string, closed: boolean, stageType = "GROUP") => ({ closed, stageType, subMatches: subs(order) })

  it("counts the closed matches and those that get a hint they did not have", () => {
    const matches = [match("WLLW", true), match("WWLW", true), match("WLLW", false), match("WLLW", true, "PLAYOFF"), match("W", true, "SEEDING")]
    const before = { comp: ruleSet("ALL", 4), playoff: ruleSet("ALL", 4) }
    const after = { comp: ruleSet("DECIDER", 5), playoff: ruleSet("ALL", 4) }
    // Closed with rules: the two group matches and the playoff match; only the 2:2 in the group now lacks its decider
    expect(ruleChangeImpact(matches, before, after)).toEqual({ closed: 3, newHints: 1 })
  })

  it("counts hints of sub-matches too", () => {
    const one = [{ closed: true, stageType: "GROUP", subMatches: [{ format: "ROUND_3V3", rounds: rounds("WWL") }] }]
    const loose = { ...ruleSet("ALL", 1), formatRules: { ROUND_3V3: { roundsToWin: 2, maxRounds: null } } }
    const strict = { ...ruleSet("ALL", 1), formatRules: { ROUND_3V3: { roundsToWin: 7, maxRounds: null } } }
    expect(ruleChangeImpact(one, { comp: null, playoff: null }, { comp: strict, playoff: null })).toEqual({ closed: 1, newHints: 1 })
    expect(ruleChangeImpact(one, { comp: strict, playoff: null }, { comp: strict, playoff: null })).toEqual({ closed: 1, newHints: 0 })
    expect(ruleChangeImpact(one, { comp: strict, playoff: null }, { comp: loose, playoff: null })).toEqual({ closed: 1, newHints: 1 })
  })
})

describe("closingHints", () => {
  it("lists what closing a match has to confirm, each sub-match by its place and format", () => {
    const played = [
      { format: "ROUND_1V1", rounds: rounds("WWWWWWW") },
      { format: "ROUND_2V2", rounds: [] },
      { format: "ROUND_4V4", rounds: rounds("WWLWWLWLW") },
    ]
    const rules: RuleSet = {
      formats: ["ROUND_1V1", "ROUND_2V2", "ROUND_4V4", "ROUND_4V4"],
      flow: "ALL",
      formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null }, ROUND_4V4: { roundsToWin: 7, maxRounds: 13 } },
      points: null,
    }
    expect(closingHints(played, matchReport(played, rules))).toEqual([
      "3. 4v4: 6:3 – target 7 not reached",
      "2 of 4 sub-matches played",
    ])
  })
})

describe("lineupPoints", () => {
  const rules = { comp: ruleSet("ALL", 4), playoff: null }
  const match = (order: string, stageType = "GROUP", confirmed?: string) => ({
    stageType, subMatches: subs(order), closedAt: confirmed ? new Date() : null, confirmedOutcome: confirmed ?? null,
  })

  it("adds up the points of the group matches", () => {
    // A win (3), a draw (1), a loss (0); the playoff win and the seeding score nothing
    const matches = [match("WWLW"), match("WLLW"), match("LLLL"), match("WWWW", "PLAYOFF"), match("W", "SEEDING")]
    expect(lineupPoints(matches, rules)).toBe(4)
  })

  it("takes the confirmed result of a closed match over the one worked out", () => {
    // Won by forfeit without a round, and a recorded win that was confirmed as a loss
    expect(lineupPoints([match("----", "GROUP", "W"), match("WWWW", "GROUP", "L")], rules)).toBe(3)
  })

  it("leaves out matches without a result", () => {
    expect(lineupPoints([match("----"), match("WWWW")], rules)).toBe(3)
    expect(lineupPoints([], rules)).toBe(0)
  })

  it("has no points without rules", () => {
    expect(lineupPoints([match("WWWW")], { comp: null, playoff: null })).toBeNull()
  })
})
