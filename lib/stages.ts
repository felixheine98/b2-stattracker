// The stages a tournament is divided into: an optional seeding, the match days of the
// group phase and the playoffs. A match belongs to exactly one stage, whatever its date.

export type StageType = "SEEDING" | "GROUP" | "PLAYOFF"

export interface StageRef {
  id: string
  type: StageType
  // Position among the stages of the same type, starting at 1
  number: number
}

// What a tournament is set up with; the stages follow from it
export interface StagePlan {
  seeding: boolean
  matchDays: number
  playoffDays: number
}

export const DEFAULT_STAGE_PLAN: StagePlan = { seeding: true, matchDays: 2, playoffDays: 1 }

const TYPE_ORDER: StageType[] = ["SEEDING", "GROUP", "PLAYOFF"]

type Stage = Pick<StageRef, "type" | "number">

// In playing order: seeding, match days, playoffs
export function sortStages<T extends Stage>(stages: T[]): T[] {
  return [...stages].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.number - b.number)
}

export function stageName(stage: Stage, stages: Stage[]): string {
  if (stage.type === "SEEDING") return "Seeding"
  if (stage.type === "GROUP") return `Match Day ${stage.number}`
  return stages.filter((s) => s.type === "PLAYOFF").length > 1 ? `Playoffs ${stage.number}` : "Playoffs"
}

// Stages are played a week apart, beginning on the tournament's start date
export function stageDate(stage: Stage, stages: Stage[], startDate: Date): Date {
  const index = sortStages(stages).findIndex((s) => s.type === stage.type && s.number === stage.number)
  const date = new Date(startDate)
  date.setUTCDate(date.getUTCDate() + 7 * Math.max(index, 0))
  return date
}

export function stagePlanOf(stages: Stage[]): StagePlan {
  const count = (type: StageType) => stages.filter((s) => s.type === type).length
  return { seeding: count("SEEDING") > 0, matchDays: count("GROUP"), playoffDays: count("PLAYOFF") }
}

// What has to change to get from the existing stages to the wanted plan. Stages are added and
// removed at the end of their kind; one that has matches is never removed but reported as blocked.
export function planStageChanges<T extends StageRef & { matchCount: number }>(
  stages: T[],
  wanted: StagePlan
): { create: Stage[]; remove: string[]; blocked: T[] } {
  const create: Stage[] = []
  const remove: string[] = []
  const blocked: T[] = []
  const targets: Array<[StageType, number]> = [
    ["SEEDING", wanted.seeding ? 1 : 0],
    ["GROUP", wanted.matchDays],
    ["PLAYOFF", wanted.playoffDays],
  ]
  for (const [type, count] of targets) {
    const existing = sortStages(stages.filter((s) => s.type === type))
    for (let number = existing.length + 1; number <= count; number++) create.push({ type, number })
    for (const stage of existing.slice(count)) {
      if (stage.matchCount > 0) blocked.push(stage)
      else remove.push(stage.id)
    }
  }
  return { create, remove, blocked }
}

// The stage a new match of a lineup most likely belongs to: the first one it has not played in yet
export function suggestStage<T extends StageRef>(stages: T[], playedStageIds: string[]): T | undefined {
  const sorted = sortStages(stages)
  return sorted.find((s) => !playedStageIds.includes(s.id)) ?? sorted[sorted.length - 1]
}
