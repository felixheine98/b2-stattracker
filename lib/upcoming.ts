import { sortStages, type StageType } from "./stages"

// Matches that are set up ahead of being played (docs/adr/008): a planned match has no result yet.
// It shows as upcoming and counts in no stats.

interface PlannableMatch {
  closedAt?: Date | string | null
  subMatches: Array<{ rounds: unknown[]; summary?: unknown | null }>
}

// Not closed, and no sub-match has a round or a summary yet
export function isPlanned(match: PlannableMatch): boolean {
  if (match.closedAt) return false
  return match.subMatches.every((sm) => sm.rounds.length === 0 && !sm.summary)
}

interface UpcomingMatch extends PlannableMatch {
  stage: { type: StageType; number: number }
  date?: Date | string | null
  number?: number | null
}

const time = (date: Date | string | null | undefined) => (date ? new Date(date).getTime() : Infinity)

// The planned matches to show as upcoming, the seeding left out as in all stats: by date, then
// the ones without a date in playing order (stage, then number)
export function upcomingMatches<T extends UpcomingMatch>(matches: T[]): T[] {
  const planned = matches.filter((m) => m.stage.type !== "SEEDING" && isPlanned(m))
  const stageIndex = (m: T) => sortStages(planned.map((p) => p.stage)).findIndex((s) => s.type === m.stage.type && s.number === m.stage.number)
  return planned.sort(
    (a, b) =>
      time(a.date) - time(b.date) || stageIndex(a) - stageIndex(b) || (a.number ?? Infinity) - (b.number ?? Infinity)
  )
}
