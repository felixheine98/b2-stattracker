// The stats of a comp's seeding in a seeding format (docs/adr/010, question 9): per lineup its team
// total with the official place and league, per player and lineup their score on each map.
import { seedingRuns, seedingScore, type RunResult, type SeedingSettings } from "./seeding"

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
  lineupId: string
  // Per map their score and whether it was among the best of the map; null where they did not drive it
  maps: Array<{ score: number | null; counted: boolean } | null>
}

export function seedingStats(settings: SeedingSettings, matches: SeedingMatchStats[]): { lineups: SeedingLineupRow[]; players: SeedingPlayerRow[] } {
  const layout = seedingRuns(settings)
  const lineups: SeedingLineupRow[] = []
  const players: SeedingPlayerRow[] = []
  for (const match of matches) {
    const score = seedingScore(settings, match.runs)
    lineups.push({ lineupId: match.lineupId, total: score.total, place: match.place, league: match.league })
    const counted = new Set(score.maps.flatMap((m) => m.counted))
    match.runs.forEach((run, i) => {
      if (!run.playerId || !layout[i]) return
      let row = players.find((p) => p.playerId === run.playerId && p.lineupId === match.lineupId)
      if (!row) players.push((row = { playerId: run.playerId, lineupId: match.lineupId, maps: Array.from({ length: settings.maps }, () => null) }))
      const entry = { score: run.score, counted: counted.has(i) }
      // Driven twice against the rules: the better run is shown
      const before = row.maps[layout[i].map]
      if (!before || (entry.score ?? -1) > (before.score ?? -1)) row.maps[layout[i].map] = entry
    })
  }
  const best = (row: SeedingPlayerRow) => Math.max(-1, ...row.maps.map((m) => m?.score ?? -1))
  players.sort((a, b) => best(b) - best(a))
  lineups.sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity) || (b.total ?? -1) - (a.total ?? -1))
  return { lineups, players }
}
