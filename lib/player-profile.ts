// Everything a player's profile page shows about their rounds for our team: lifetime stats,
// and per tournament the stats, the maps and the matches. Seeding matches are left out of the
// stats like everywhere else; only their times count for the personal bests.
import type { Format } from "@prisma/client"
import { FORMAT_ORDER } from "./format-stats"
import { addGap, emptyPace, finishTime, paceMs, pacePct, roundBest, type PaceSum } from "./pace"
import { roundPlacements, roundScore } from "./round-score"
import type { StageType } from "./stages"

export interface ProfileMatch {
  id: string
  tournamentId: string
  tournamentLineupId: string | null
  stage: { type: StageType }
  subMatches: Array<{
    format: Format
    // Results of a round must be in finishing order
    rounds: Array<{
      track: string | null
      results: Array<{ playerId: string | null; isOurTeam: boolean; dnf?: boolean | null; timeMs?: number | null }>
    }>
  }>
}

export interface ProfileTournament {
  id: string
  lineups: Array<{ id: string; playerIds: string[] }>
}

// A pace in percent next to what the team drives: the average over all results of our players,
// and the place among everyone with at least one timed round
export interface RankedPace {
  value: number | null
  team: number | null
  rank: number | null
  of: number
}

export interface StatLine {
  roundsPlayed: number
  placementSum: number
  dnfs: number
  // Rounds the player took part in
  roundsWon: number
  roundsLost: number
  pace: RankedPace
}

export interface MapLine {
  track: string
  // Personal best, the match it was driven in and its place among the bests of our players
  pbMs: number | null
  pbMatchId: string | null
  pbRank: number | null
  pbOf: number
  // Behind the fastest personal best of our players
  pbGapMs: number | null
  // Timed rounds outside the seeding and the average gap to the fastest time of each
  rounds: number
  avgGapMs: number | null
  avgGapRank: number | null
  avgGapOf: number
}

export interface CompProfile {
  tournamentId: string
  // The lineup the player is in the roster of first, then others they drove for
  lineupIds: string[]
  inRoster: boolean
  // Drove at least one round
  deployed: boolean
  total: StatLine
  formats: Array<StatLine & { format: Format }>
  maps: MapLine[]
  matches: Array<{ matchId: string; roundsPlayed: number; pace: number | null }>
}

export interface Profile {
  total: StatLine
  formats: Array<StatLine & { format: Format }>
  // In the order of the given tournaments
  comps: CompProfile[]
}

interface Acc {
  roundsPlayed: number
  placementSum: number
  dnfs: number
  roundsWon: number
  roundsLost: number
  pace: PaceSum
}

interface MapAcc {
  pbMs: number | null
  pbMatchId: string | null
  pace: PaceSum
}

const emptyAcc = (): Acc => ({ roundsPlayed: 0, placementSum: 0, dnfs: 0, roundsWon: 0, roundsLost: 0, pace: emptyPace() })

function entry<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  if (!map.has(key)) map.set(key, create())
  return map.get(key)!
}

// Place of a value among the given ones, smaller is better; equal values share a place
function rankOf(value: number | null, values: number[]): number | null {
  return value === null ? null : 1 + values.filter((v) => v < value).length
}

const present = (value: number | null): value is number => value !== null

export function buildProfile(playerId: string, tournaments: ProfileTournament[], matches: ProfileMatch[]): Profile {
  // Sums of every player of ours, per scope: everything, a format, a tournament, a match
  const scopes = new Map<string, Map<string, Acc>>()
  // Likewise per map of a tournament
  const maps = new Map<string, Map<string, MapAcc>>()
  const drivenLineups = new Map<string, string[]>()
  const drivenMatches = new Map<string, string[]>()

  for (const match of matches) {
    const tid = match.tournamentId
    const seeding = match.stage.type === "SEEDING"
    for (const sm of match.subMatches) {
      const keys = seeding ? [] : ["all", `f:${sm.format}`, `c:${tid}`, `c:${tid}|f:${sm.format}`, `m:${match.id}`]
      for (const round of sm.rounds) {
        const outcome = roundScore(round.results)?.outcome
        const placements = roundPlacements(round.results)
        const best = roundBest(round.results)

        round.results.forEach((r, idx) => {
          if (!r.isOurTeam || !r.playerId) return
          const time = finishTime(r)

          for (const key of keys) {
            const acc = entry(entry(scopes, key, () => new Map<string, Acc>()), r.playerId, emptyAcc)
            acc.roundsPlayed++
            acc.placementSum += placements[idx]
            if (r.dnf) acc.dnfs++
            if (outcome === "W") acc.roundsWon++
            else if (outcome === "L") acc.roundsLost++
            if (time !== null && best !== null) addGap(acc.pace, time, best)
          }

          if (round.track && time !== null) {
            const map = entry(entry(maps, `${tid}|${round.track}`, () => new Map<string, MapAcc>()), r.playerId, () => ({ pbMs: null, pbMatchId: null, pace: emptyPace() }))
            if (map.pbMs === null || time < map.pbMs) { map.pbMs = time; map.pbMatchId = match.id }
            if (!seeding && best !== null) addGap(map.pace, time, best)
          }

          if (r.playerId !== playerId) return
          const lineups = entry(drivenLineups, tid, () => [])
          if (match.tournamentLineupId && !lineups.includes(match.tournamentLineupId)) lineups.push(match.tournamentLineupId)
          const driven = entry(drivenMatches, tid, () => [])
          if (!seeding && !driven.includes(match.id)) driven.push(match.id)
        })
      }
    }
  }

  function line(key: string): StatLine {
    const everyone = [...(scopes.get(key)?.values() ?? [])]
    const { pace, ...acc } = scopes.get(key)?.get(playerId) ?? emptyAcc()
    const paces = everyone.map((a) => pacePct(a.pace)).filter(present)
    const team = everyone.reduce((sum, a) => ({ rounds: sum.rounds + a.pace.rounds, pctSum: sum.pctSum + a.pace.pctSum, msSum: 0 }), emptyPace())
    const value = pacePct(pace)
    return { ...acc, pace: { value, team: pacePct(team), rank: rankOf(value, paces), of: paces.length } }
  }

  const formatLines = (prefix: string) =>
    FORMAT_ORDER.map((format) => ({ format, ...line(`${prefix}f:${format}`) })).filter((f) => f.roundsPlayed > 0)

  function mapLines(tid: string): MapLine[] {
    return [...maps.entries()]
      .filter(([key, players]) => key.startsWith(`${tid}|`) && players.has(playerId))
      .map(([key, players]) => {
        const own = players.get(playerId)!
        const bests = [...players.values()].map((p) => p.pbMs).filter(present)
        const gaps = [...players.values()].map((p) => paceMs(p.pace)).filter(present)
        const avgGapMs = paceMs(own.pace)
        return {
          track: key.slice(tid.length + 1),
          pbMs: own.pbMs,
          pbMatchId: own.pbMatchId,
          pbRank: rankOf(own.pbMs, bests),
          pbOf: bests.length,
          pbGapMs: own.pbMs === null ? null : own.pbMs - Math.min(...bests),
          rounds: own.pace.rounds,
          avgGapMs,
          avgGapRank: rankOf(avgGapMs, gaps),
          avgGapOf: gaps.length,
        }
      })
      .sort((a, b) => a.track.localeCompare(b.track))
  }

  const comps: CompProfile[] = []
  for (const tournament of tournaments) {
    const roster = tournament.lineups.filter((l) => l.playerIds.includes(playerId)).map((l) => l.id)
    const driven = drivenLineups.get(tournament.id)
    if (roster.length === 0 && !driven) continue
    comps.push({
      tournamentId: tournament.id,
      lineupIds: [...roster, ...(driven ?? []).filter((id) => !roster.includes(id))],
      inRoster: roster.length > 0,
      deployed: !!driven,
      total: line(`c:${tournament.id}`),
      formats: formatLines(`c:${tournament.id}|`),
      maps: mapLines(tournament.id),
      matches: (drivenMatches.get(tournament.id) ?? []).map((matchId) => {
        const stats = line(`m:${matchId}`)
        return { matchId, roundsPlayed: stats.roundsPlayed, pace: stats.pace.value }
      }),
    })
  }

  return { total: line("all"), formats: formatLines(""), comps }
}
