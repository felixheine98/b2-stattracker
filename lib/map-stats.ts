// Stats of our team per map, shown next to the stats per format on the lineup and tournament
// pages: who drives how well on which map. A map is driven in several formats, so a table mixes
// them; the placement only means something while a single format is looked at.
import type { Format } from "@prisma/client"
import { FORMAT_ORDER, type StatsMatch } from "./format-stats"
import { addGap, emptyPace, finishTime, paceMs, roundBest, type PaceSum } from "./pace"
import { roundPlacements, roundScore } from "./round-score"
import { playerRecord } from "./summary"

export interface MapPlayerAggregate {
  tmId: string
  name: string
  currentName?: string
  rounds: number
  placementSum: number
  // Fastest time on the map; null without a finished round
  bestMs: number | null
  // Gap to the fastest time of each round (see lib/pace.ts)
  pace: PaceSum
  dnfs: number
  // Rounds the player took part in
  roundsWon: number
  roundsLost: number
}

export interface MapAggregate {
  // null: rounds that have no map entered
  track: string | null
  // Formats the map was driven in
  formats: Format[]
  teamRoundsWon: number
  teamRoundsLost: number
  mapWon: number
  mapLost: number
  mapDrawn: number
  // Fastest time of one of ours on the map, and the sum and number of all our finished rounds
  teamBestMs: number | null
  teamTimeSum: number
  teamTimeCount: number
  // keyed by tmId
  players: Map<string, MapPlayerAggregate>
}

// Average time of our drivers on a map in milliseconds; null while none of them finished
export function teamAvgMs(agg: MapAggregate): number | null {
  return agg.teamTimeCount > 0 ? agg.teamTimeSum / agg.teamTimeCount : null
}

// Average gap of a player on a map in milliseconds; null without a timed round
export function mapGapMs(player: MapPlayerAggregate): number | null {
  return paceMs(player.pace)
}

// Stats summed up per map. Seeding matches are left out, as in the stats per format. The maps
// come in the order they were first played (stageOrder: stage IDs in playing order), then by name.
export function buildMapAggregates(matches: StatsMatch[], stageOrder: string[]): MapAggregate[] {
  const byMap = new Map<string, MapAggregate & { firstStage: number }>()

  for (const match of matches) {
    if (match.stage.type === "SEEDING") continue
    const stageIndex = stageOrder.indexOf(match.stage.id)
    const firstStage = stageIndex === -1 ? stageOrder.length : stageIndex

    // The aggregate of a map as driven in this sub-match; the same map written differently is one map
    const mapOf = (track: string | null | undefined, format: Format) => {
      const key = track?.trim().toLowerCase() ?? ""
      if (!byMap.has(key)) {
        byMap.set(key, {
          track: key ? track!.trim() : null,
          formats: [],
          teamRoundsWon: 0, teamRoundsLost: 0,
          mapWon: 0, mapLost: 0, mapDrawn: 0,
          teamBestMs: null, teamTimeSum: 0, teamTimeCount: 0,
          players: new Map(),
          firstStage,
        })
      }
      const agg = byMap.get(key)!
      agg.firstStage = Math.min(agg.firstStage, firstStage)
      if (!agg.formats.includes(format)) agg.formats.push(format)
      return { key, agg }
    }

    for (const sm of match.subMatches) {
      if (sm.summary) {
        // Summary results have no times
        const summary = sm.summary
        const { agg } = mapOf(summary.track, sm.format)
        agg.teamRoundsWon += summary.roundsWon ?? 0
        agg.teamRoundsLost += summary.roundsLost ?? 0
        if (summary.outcome === "W") agg.mapWon++
        else if (summary.outcome === "L") agg.mapLost++
        else agg.mapDrawn++
        for (const sp of summary.players) {
          if (!agg.players.has(sp.tmId)) {
            agg.players.set(sp.tmId, { tmId: sp.tmId, name: sp.playerName, currentName: sp.currentName, rounds: 0, placementSum: 0, bestMs: null, pace: emptyPace(), dnfs: 0, roundsWon: 0, roundsLost: 0 })
          }
          const p = agg.players.get(sp.tmId)!
          const { won, lost } = playerRecord(summary, sp)
          // Without places the rounds would lower the average place, so they count for the record only
          if (sp.placementSum !== null) {
            p.rounds += sp.rounds
            p.placementSum += sp.placementSum
          }
          p.roundsWon += won
          p.roundsLost += lost
        }
        continue
      }

      // Won and lost rounds of this sub-match per map, to tell who took the map
      const tally = new Map<string, { won: number; lost: number }>()

      for (const round of sm.rounds) {
        const { key, agg } = mapOf(round.track, sm.format)
        if (!tally.has(key)) tally.set(key, { won: 0, lost: 0 })

        const o = roundScore(round.results)?.outcome
        const placements = roundPlacements(round.results)
        const best = roundBest(round.results)
        if (o === "W") { agg.teamRoundsWon++; tally.get(key)!.won++ }
        else if (o === "L") { agg.teamRoundsLost++; tally.get(key)!.lost++ }

        round.results.forEach((r, idx) => {
          if (!r.isOurTeam) return
          if (!agg.players.has(r.tmId)) {
            agg.players.set(r.tmId, { tmId: r.tmId, name: r.playerName, currentName: r.currentName, rounds: 0, placementSum: 0, bestMs: null, pace: emptyPace(), dnfs: 0, roundsWon: 0, roundsLost: 0 })
          }
          const p = agg.players.get(r.tmId)!
          p.rounds++
          p.placementSum += placements[idx]
          if (r.dnf) p.dnfs++
          if (o === "W") p.roundsWon++
          else if (o === "L") p.roundsLost++
          const time = finishTime(r)
          if (time !== null) {
            if (agg.teamBestMs === null || time < agg.teamBestMs) agg.teamBestMs = time
            agg.teamTimeSum += time
            agg.teamTimeCount++
            if (p.bestMs === null || time < p.bestMs) p.bestMs = time
            if (best !== null) addGap(p.pace, time, best)
          }
        })
      }

      for (const [key, { won, lost }] of tally) {
        if (won + lost === 0) continue
        const agg = byMap.get(key)!
        if (won > lost) agg.mapWon++
        else if (lost > won) agg.mapLost++
        else agg.mapDrawn++
      }
    }
  }

  return [...byMap.values()]
    .filter((agg) => agg.players.size > 0)
    .sort(
      (a, b) =>
        Number(a.track === null) - Number(b.track === null) ||
        a.firstStage - b.firstStage ||
        (a.track ?? "").localeCompare(b.track ?? "")
    )
    .map((agg) => ({
      track: agg.track,
      formats: FORMAT_ORDER.filter((f) => agg.formats.includes(f)),
      teamRoundsWon: agg.teamRoundsWon, teamRoundsLost: agg.teamRoundsLost,
      mapWon: agg.mapWon, mapLost: agg.mapLost, mapDrawn: agg.mapDrawn,
      teamBestMs: agg.teamBestMs, teamTimeSum: agg.teamTimeSum, teamTimeCount: agg.teamTimeCount,
      players: agg.players,
    }))
}
