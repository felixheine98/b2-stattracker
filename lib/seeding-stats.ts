// The stats of a comp's seeding in a seeding format (docs/adr/010, question 9): per lineup its team
// total with the official place and league, per player their runs and scores over all lineups.
import { seedingScore, type RunResult, type SeedingSettings } from "./seeding"

export interface SeedingMatchStats {
  lineupId: string
  place: number | null
  league: string | null
  // The runs of its seeding match in the order of seedingRuns
  runs: RunResult[]
}

export interface SeedingLineupRow {
  lineupId: string
  total: number | null
  place: number | null
  league: string | null
}

export interface SeedingPlayerRow {
  playerId: string
  runs: number
  // Runs with a score, which the average is taken over
  scored: number
  average: number | null
  best: number | null
  // Runs among the best of their map, which made up the team total
  counted: number
}

export function seedingStats(settings: SeedingSettings, matches: SeedingMatchStats[]): { lineups: SeedingLineupRow[]; players: SeedingPlayerRow[] } {
  const lineups: SeedingLineupRow[] = []
  const players = new Map<string, { runs: number; scores: number[]; counted: number }>()
  for (const match of matches) {
    const score = seedingScore(settings, match.runs)
    lineups.push({ lineupId: match.lineupId, total: score.total, place: match.place, league: match.league })
    const counted = new Set(score.maps.flatMap((m) => m.counted))
    match.runs.forEach((run, i) => {
      if (!run.playerId) return
      const entry = players.get(run.playerId) ?? { runs: 0, scores: [], counted: 0 }
      entry.runs++
      if (run.score != null) entry.scores.push(run.score)
      if (counted.has(i)) entry.counted++
      players.set(run.playerId, entry)
    })
  }
  const rows = [...players].map(([playerId, e]): SeedingPlayerRow => ({
    playerId,
    runs: e.runs,
    scored: e.scores.length,
    average: e.scores.length ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length : null,
    best: e.scores.length ? Math.max(...e.scores) : null,
    counted: e.counted,
  }))
  rows.sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
  lineups.sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity) || (b.total ?? -1) - (a.total ?? -1))
  return { lineups, players: rows }
}
