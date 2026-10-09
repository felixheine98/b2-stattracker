import { describe, expect, it } from "vitest"
import { planStageChanges, sortStages, stageDate, stageName, stagePlanOf, suggestStage, type StageType } from "./stages"

const stage = (type: StageType, number: number, matchCount = 0) => ({ id: `${type}-${number}`, type, number, matchCount })

// Seeding, two match days and one day of playoffs, deliberately out of order
const standard = [stage("PLAYOFF", 1), stage("GROUP", 2), stage("SEEDING", 1), stage("GROUP", 1)]

describe("sortStages", () => {
  it("puts seeding first, then the match days, then the playoffs", () => {
    expect(sortStages(standard).map((s) => s.id)).toEqual(["SEEDING-1", "GROUP-1", "GROUP-2", "PLAYOFF-1"])
  })
})

describe("stageName", () => {
  it("numbers the match days", () => {
    expect(stageName(stage("SEEDING", 1), standard)).toBe("Seeding")
    expect(stageName(stage("GROUP", 2), standard)).toBe("Match Day 2")
  })

  it("numbers the playoffs only when there are several days", () => {
    expect(stageName(stage("PLAYOFF", 1), standard)).toBe("Playoffs")
    expect(stageName(stage("PLAYOFF", 1), [...standard, stage("PLAYOFF", 2)])).toBe("Playoffs 1")
  })
})

describe("stageDate", () => {
  const start = new Date("2026-06-07")

  it("is the start date for the first stage and a week later for each following one", () => {
    expect(stageDate(stage("SEEDING", 1), standard, start)).toEqual(new Date("2026-06-07"))
    expect(stageDate(stage("GROUP", 2), standard, start)).toEqual(new Date("2026-06-21"))
    expect(stageDate(stage("PLAYOFF", 1), standard, start)).toEqual(new Date("2026-06-28"))
  })

  it("starts with match day 1 when there is no seeding", () => {
    const withoutSeeding = standard.filter((s) => s.type !== "SEEDING")
    expect(stageDate(stage("GROUP", 1), withoutSeeding, start)).toEqual(new Date("2026-06-07"))
  })
})

describe("stagePlanOf", () => {
  it("counts the stages of each kind", () => {
    expect(stagePlanOf(standard)).toEqual({ seeding: true, matchDays: 2, playoffDays: 1 })
    expect(stagePlanOf([stage("GROUP", 1)])).toEqual({ seeding: false, matchDays: 1, playoffDays: 0 })
  })
})

describe("planStageChanges", () => {
  it("creates all stages of a new tournament", () => {
    expect(planStageChanges([], { seeding: true, matchDays: 2, playoffDays: 1 })).toEqual({
      create: [
        { type: "SEEDING", number: 1 },
        { type: "GROUP", number: 1 },
        { type: "GROUP", number: 2 },
        { type: "PLAYOFF", number: 1 },
      ],
      remove: [],
      blocked: [],
    })
  })

  it("adds stages after the existing ones of their kind", () => {
    expect(planStageChanges(standard, { seeding: true, matchDays: 3, playoffDays: 2 }).create).toEqual([
      { type: "GROUP", number: 3 },
      { type: "PLAYOFF", number: 2 },
    ])
  })

  it("removes the last stages of a kind, and the seeding when it is switched off", () => {
    expect(planStageChanges(standard, { seeding: false, matchDays: 1, playoffDays: 0 })).toEqual({
      create: [],
      remove: ["SEEDING-1", "GROUP-2", "PLAYOFF-1"],
      blocked: [],
    })
  })

  it("does not remove a stage that has matches", () => {
    const played = [stage("SEEDING", 1), stage("GROUP", 1, 4), stage("GROUP", 2, 1)]
    const plan = planStageChanges(played, { seeding: true, matchDays: 1, playoffDays: 0 })
    expect(plan.remove).toEqual([])
    expect(plan.blocked.map((s) => s.id)).toEqual(["GROUP-2"])
  })
})

describe("suggestStage", () => {
  it("is the first stage the lineup has no match in yet", () => {
    expect(suggestStage(standard, [])?.id).toBe("SEEDING-1")
    expect(suggestStage(standard, ["SEEDING-1", "GROUP-1"])?.id).toBe("GROUP-2")
  })

  it("is the last stage once the lineup has played in all of them", () => {
    expect(suggestStage(standard, standard.map((s) => s.id))?.id).toBe("PLAYOFF-1")
  })
})
