// Summary results (docs/adr/007-zusammengefasste-ergebnisse.md): a sub-match taken over from an
// old stats screenshot has no rounds, only its result and per player the rounds driven and the
// sum of their places. It counts in the stats of rounds, places and records, never in pace,
// times or DNFs.
import type { Outcome } from "./match-rules"
import type { NameFields } from "./player-names"

export interface SummaryPlayer extends NameFields {
  playerId: string
  tmId: string
  playerName: string
  rounds: number
  // null: the screenshot gives no places (points instead), so the sub-match counts for the record only
  placementSum: number | null
  // Points instead of places, as some comps (FSM) list them
  points?: number | null
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
  // The Discord message with the screenshot, and the image in the local export
  sourceUrl?: string
  sourceImage?: string | null
}

// Rounds won and lost that count for a player: those of the team, but only if they drove every
// round of the sub-match, otherwise the split is unknown
export function playerRecord(summary: SubMatchSummary, player: SummaryPlayer): { won: number; lost: number } {
  if (player.rounds < summary.rounds) return { won: 0, lost: 0 }
  return { won: summary.roundsWon ?? 0, lost: summary.roundsLost ?? 0 }
}

// A summary as stored (see summaryInclude)
interface StoredSummary {
  track: string | null
  rounds: number
  roundsWon: number | null
  roundsLost: number | null
  outcome: string
  sourceUrl: string
  sourceImage: string | null
  players: Array<{ playerId: string; rounds: number; placementSum: number | null; points: number | null; player: { tmId: string; name: string } }>
}

// What to include with a sub-match to load its summary
export const summaryInclude = {
  summary: { include: { players: { orderBy: { id: "asc" as const }, include: { player: { select: { tmId: true, name: true } } } } } },
}

type Shaped<S> = Omit<S, "summary"> & { summary: SubMatchSummary | null }

// Loaded matches with the summaries of their sub-matches in the shape the stats take
export function shapeSummaries<M extends { subMatches: Array<{ summary?: StoredSummary | null }> }>(
  matches: M[],
): Array<Omit<M, "subMatches"> & { subMatches: Array<Shaped<M["subMatches"][number]>> }> {
  return matches.map((match) => ({
    ...match,
    subMatches: match.subMatches.map((sm) => ({ ...sm, summary: sm.summary ? toSummary(sm.summary) : null })),
  })) as Array<Omit<M, "subMatches"> & { subMatches: Array<Shaped<M["subMatches"][number]>> }>
}

function toSummary({ players, outcome, ...summary }: StoredSummary): SubMatchSummary {
  return {
    ...summary,
    outcome: outcome as SubMatchSummary["outcome"],
    players: players.map((p) => ({ playerId: p.playerId, tmId: p.player.tmId, playerName: p.player.name, rounds: p.rounds, placementSum: p.placementSum, points: p.points })),
  }
}
