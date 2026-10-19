// Summary results (docs/adr/007-zusammengefasste-ergebnisse.md): a sub-match taken over from an
// old stats screenshot has no rounds, only its result and per player the rounds driven and the
// sum of their places. It counts in the stats of rounds, places and records, never in pace,
// times or DNFs.
import type { Outcome } from "./match-rules"

export interface SummaryPlayer {
  playerId: string
  tmId: string
  playerName: string
  // Today's name, when the data carries tournament names
  currentName?: string
  rounds: number
  placementSum: number
}

export interface SubMatchSummary {
  // The map, when the screenshot names it
  track: string | null
  // Rounds of the sub-match
  rounds: number
  // Rounds won and lost by our team; null where the screenshot gives no round result
  roundsWon: number | null
  roundsLost: number | null
  // Who took the sub-match
  outcome: Outcome
  players: SummaryPlayer[]
}

// Rounds won and lost that count for a player: those of the team, but only if they drove every
// round of the sub-match, otherwise the split is unknown
export function playerRecord(summary: SubMatchSummary, player: SummaryPlayer): { won: number; lost: number } {
  if (player.rounds < summary.rounds) return { won: 0, lost: 0 }
  return { won: summary.roundsWon ?? 0, lost: summary.roundsLost ?? 0 }
}
