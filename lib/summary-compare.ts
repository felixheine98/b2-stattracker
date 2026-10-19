// The comparison page (docs/adr/007): what a comp's screenshots say next to what is stored, an
// imported summary or a match with round results, which takes precedence and is only checked.
import type { Format } from "@prisma/client"
import { subMatchState, summaryState, type Outcome } from "./match-rules"
import { roundPlacements, type ScoredResult } from "./round-score"
import type { SubMatchSummary } from "./summary"
import type { PlannedMatch } from "./summary-import"

export interface StoredMatch {
  subMatches: Array<{
    format: Format
    order: number
    // Results of a round in finishing order
    rounds: Array<{ results: Array<ScoredResult & { tmId: string; playerName: string }> }>
    summary: SubMatchSummary | null
  }>
}

interface Values {
  rounds: number
  placementSum: number
}

export interface ComparedSubMatch {
  order: number
  format: Format
  track: string | null
  sourceImage: string
  // What the stored sub-match is made of; null: there is none
  kind: "summary" | "rounds" | null
  file: { won: number | null; lost: number | null; outcome: Outcome }
  stored: { won: number; lost: number; outcome: Outcome | null } | null
  resultDiffers: boolean
  players: Array<{ tmId: string; name: string; file: Values | null; stored: Values | null; differs: boolean }>
}

type StoredSubMatch = StoredMatch["subMatches"][number]

// Per player of ours: rounds driven and the sum of places
function storedValues(sm: StoredSubMatch): Map<string, Values & { name: string }> {
  const values = new Map<string, Values & { name: string }>()
  if (sm.summary) {
    for (const p of sm.summary.players) values.set(p.tmId, { name: p.playerName, rounds: p.rounds, placementSum: p.placementSum })
    return values
  }
  for (const round of sm.rounds) {
    const placements = roundPlacements(round.results)
    round.results.forEach((r, i) => {
      if (!r.isOurTeam) return
      const v = values.get(r.tmId) ?? { name: r.playerName, rounds: 0, placementSum: 0 }
      v.rounds++
      v.placementSum += placements[i]
      values.set(r.tmId, v)
    })
  }
  return values
}

const same = (a: Values | null, b: Values | null) => !!a && !!b && a.rounds === b.rounds && a.placementSum === b.placementSum

// Each sub-match of the screenshot next to the first unused stored sub-match of its format
export function compareMatch(planned: PlannedMatch, stored: StoredMatch | null): ComparedSubMatch[] {
  const unused = [...(stored?.subMatches ?? [])].sort((a, b) => a.order - b.order)
  return planned.subMatches.map((psm) => {
    const index = unused.findIndex((s) => s.format === psm.format)
    const sm = index === -1 ? null : unused.splice(index, 1)[0]
    const file = { won: psm.roundsWon, lost: psm.roundsLost, outcome: psm.outcome }

    let result: ComparedSubMatch["stored"] = null
    if (sm) {
      const state = sm.summary ? summaryState(sm.summary) : subMatchState(sm.rounds, null)
      result = { won: state.won, lost: state.lost, outcome: state.outcome }
    }
    const resultDiffers = !result || result.outcome !== file.outcome || (file.won !== null && file.lost !== null && (result.won !== file.won || result.lost !== file.lost))

    const values = sm ? storedValues(sm) : new Map<string, Values & { name: string }>()
    const players: ComparedSubMatch["players"] = psm.players.map((p) => {
      const s = values.get(p.tmId)
      const fileValues = { rounds: p.rounds, placementSum: p.placementSum }
      const storedValues = s ? { rounds: s.rounds, placementSum: s.placementSum } : null
      return { tmId: p.tmId, name: p.name, file: fileValues, stored: storedValues, differs: !same(fileValues, storedValues) }
    })
    for (const [tmId, s] of values) {
      if (psm.players.some((p) => p.tmId === tmId)) continue
      players.push({ tmId, name: s.name, file: null, stored: { rounds: s.rounds, placementSum: s.placementSum }, differs: true })
    }

    return {
      order: psm.order, format: psm.format, track: psm.track, sourceImage: psm.sourceImage,
      kind: sm ? (sm.summary ? "summary" : "rounds") : null,
      file, stored: result, resultDiffers, players,
    }
  })
}
