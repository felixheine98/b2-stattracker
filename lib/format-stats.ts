// Stats of our team summed up over matches, shown on the lineup and tournament pages
import type { Format } from "@prisma/client"
import { roundPlacements, roundScore } from "./round-score"
import type { StageType } from "./stages"

interface StatsRoundResult {
  id: string
  tmId: string
  playerName: string
  isOurTeam: boolean
  dnf?: boolean | null
}

export interface StatsMatch {
  id: string
  stage: { id: string; type: StageType }
  tournamentLineupId?: string | null
  subMatches: Array<{
    format: Format
    // Results of a round must be in finishing order
    rounds: Array<{ results: StatsRoundResult[] }>
  }>
}

interface PlayerAggregate {
  tmId: string
  name: string
  roundsPlayed: number
  placementSum: number
  // Rounds the player took part in
  roundsWon: number
  roundsLost: number
  dnfs: number
}

export interface FormatAggregate {
  format: Format
  teamRoundsWon: number
  teamRoundsLost: number
  mapWon: number
  mapLost: number
  mapDrawn: number
  // keyed by tmId
  players: Map<string, PlayerAggregate>
}

// The matches the stats are limited to: those of the given lineups, or all matches if none is given
export function matchesOfLineups<T extends { tournamentLineupId?: string | null }>(matches: T[], lineupIds: string[]): T[] {
  if (lineupIds.length === 0) return matches
  return matches.filter((m) => m.tournamentLineupId != null && lineupIds.includes(m.tournamentLineupId))
}

// Likewise for the stages of a tournament
export function matchesOfStages<T extends { stage: { id: string } }>(matches: T[], stageIds: string[]): T[] {
  if (stageIds.length === 0) return matches
  return matches.filter((m) => stageIds.includes(m.stage.id))
}

// Stats summed up per format. Seeding matches are left out; their numbers are shown on the match page only.
export function buildAggregates(matches: StatsMatch[]): FormatAggregate[] {
  const byFormat = new Map<Format, FormatAggregate>()

  for (const match of matches) {
    if (match.stage.type === "SEEDING") continue
    for (const sm of match.subMatches) {
      if (!byFormat.has(sm.format)) {
        byFormat.set(sm.format, {
          format: sm.format,
          teamRoundsWon: 0, teamRoundsLost: 0,
          mapWon: 0, mapLost: 0, mapDrawn: 0,
          players: new Map(),
        })
      }
      const agg = byFormat.get(sm.format)!
      let smWon = 0, smLost = 0

      for (const round of sm.rounds) {
        const o = roundScore(round.results)?.outcome
        const placements = roundPlacements(round.results)
        if (o === "W") { agg.teamRoundsWon++; smWon++ }
        else if (o === "L") { agg.teamRoundsLost++; smLost++ }

        round.results.forEach((r, idx) => {
          if (!r.isOurTeam) return
          if (!agg.players.has(r.tmId)) {
            agg.players.set(r.tmId, { tmId: r.tmId, name: r.playerName, roundsPlayed: 0, placementSum: 0, roundsWon: 0, roundsLost: 0, dnfs: 0 })
          }
          const p = agg.players.get(r.tmId)!
          p.roundsPlayed++
          p.placementSum += placements[idx]
          if (r.dnf) p.dnfs++
          if (o === "W") p.roundsWon++
          else if (o === "L") p.roundsLost++
        })
      }

      if (sm.rounds.length > 0 && (smWon + smLost) > 0) {
        if (smWon > smLost) agg.mapWon++
        else if (smLost > smWon) agg.mapLost++
        else agg.mapDrawn++
      }
    }
  }

  // Only return formats with actual data, ordered sensibly
  const order: Format[] = ["TIME_ATTACK_10", "ROUND_1V1", "ROUND_2V2", "ROUND_3V3", "ROUND_4V4", "ROUND_5V5"]
  return order
    .filter((f) => byFormat.has(f) && byFormat.get(f)!.players.size > 0)
    .map((f) => byFormat.get(f)!)
}
