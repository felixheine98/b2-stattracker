import { matchReport } from "./match-rules"
import { roundPlacements, roundScore } from "./round-score"
import type { SubMatchSummary } from "./summary"

export const opponentNameKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en")
export function findRosterIdentity<T extends { name: string; initialName?: string; opponentNames?: string[] }>(players: T[], name: string): T | null {
  const key = opponentNameKey(name)
  const found = players.filter(p => [p.name, p.initialName ?? "", ...(p.opponentNames ?? [])].some(n => opponentNameKey(n) === key))
  return found.length === 1 ? found[0] : null
}
export function relatedLineupIds(id: string, lineups: Array<{ id: string; previousId: string | null }>): string[] {
  const found = new Set([id])
  for (;;) {
    const before = found.size
    for (const l of lineups) if (l.previousId && (found.has(l.id) || found.has(l.previousId))) { found.add(l.id); found.add(l.previousId) }
    if (before === found.size) return [...found]
  }
}
export function confirmedTmId(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null
}
export function resolveOpponentName(name: string, entries: Array<{ id: string; name: string; aliases: string[] }>): string | null {
  const key = opponentNameKey(name)
  const found = entries.filter(e => [e.name, ...e.aliases].some(n => opponentNameKey(n) === key))
  return found.length === 1 ? found[0].id : null
}
export function rosterDifference(local: Array<{ name: string }>, source: Array<{ name: string }>) {
  return {
    added: source.filter(p => !local.some(l => opponentNameKey(l.name) === opponentNameKey(p.name))).map(p => p.name),
    removed: local.filter(p => !source.some(l => opponentNameKey(l.name) === opponentNameKey(p.name))).map(p => p.name),
  }
}

export interface OpponentResult {
  tmId: string; playerId?: string | null; playerName: string; isOurTeam: boolean; timeMs?: number | null; dnf?: boolean | null
}
interface StatsSubMatch { format?: string; rounds: Array<{ track?: string | null; results: OpponentResult[] }>; summary?: SubMatchSummary | null }
export interface OpponentStatsMatch {
  id: string; tournamentId: string; tournament?: { name: string }; stage?: { type: string }
  closedAt?: Date | string | null; confirmedOutcome?: string | null; subMatches: StatsSubMatch[]
}
// Match outcome is always from our team's perspective, just like roundScore.
export function suggestMatchOutcome(subMatches: StatsSubMatch[]): "W" | "L" | "D" | null {
  return matchReport(subMatches.map((sm) => ({ format: sm.format ?? "", rounds: sm.rounds, summary: sm.summary })), null).outcome
}
interface PlayerStats {
  playerId: string | null; tmId: string; name: string; format: string; played: number; won: number; drawn: number; lost: number
  points: number; placeSum: number; avgPlace: number; dnfs: number; measured: number
}
interface MapStats {
  playerId: string | null; tmId: string; name: string; format: string; tournamentId: string; competition: string; track: string
  measured: number; best: number; average: number; median: number
}
export function opponentStats(matches: OpponentStatsMatch[]) {
  const balance = { won: 0, drawn: 0, lost: 0, open: 0 }
  const players = new Map<string, PlayerStats>()
  const maps = new Map<string, MapStats & { times: number[] }>()
  for (const match of matches) {
    if (match.stage?.type === "SEEDING") continue
    if (!match.closedAt || !match.confirmedOutcome) balance.open++
    else if (match.confirmedOutcome === "W") balance.won++
    else if (match.confirmedOutcome === "L") balance.lost++
    else if (match.confirmedOutcome === "D") balance.drawn++
    for (const sm of match.subMatches) {
      if (sm.format === "TIME_ATTACK_10") continue
      for (const round of sm.rounds) {
        const placements = roundPlacements(round.results)
        const outcome = roundScore(round.results)?.outcome
        round.results.forEach((r, i) => {
          const tmId = confirmedTmId(r.tmId)
          if (r.isOurTeam || !tmId) return
          const key = JSON.stringify([tmId, sm.format])
          const p = players.get(key) ?? { playerId: r.playerId ?? null, tmId, name: r.playerName, format: sm.format ?? "", played: 0, won: 0, drawn: 0, lost: 0, points: 0, placeSum: 0, avgPlace: 0, dnfs: 0, measured: 0 }
          p.played++; p.placeSum += placements[i]; p.avgPlace = p.placeSum / p.played
          p.points += r.dnf ? 0 : round.results.length - placements[i] + 1
          if (r.dnf) p.dnfs++
          // Personal balance is from the opposing player's side.
          if (outcome === "L") p.won++
          if (outcome === "W") p.lost++
          if (outcome === "D") p.drawn++
          const hasTime = !r.dnf && r.timeMs != null && r.timeMs > 0
          if (hasTime) p.measured++
          players.set(key, p)
          if (!hasTime || !round.track?.trim()) return
          const mapKey = JSON.stringify([tmId, sm.format, match.tournamentId, round.track.trim()])
          const m = maps.get(mapKey) ?? { playerId: r.playerId ?? null, tmId, name: r.playerName, format: sm.format ?? "", tournamentId: match.tournamentId, competition: match.tournament?.name ?? match.tournamentId, track: round.track.trim(), measured: 0, best: 0, average: 0, median: 0, times: [] }
          m.times.push(r.timeMs!); maps.set(mapKey, m)
        })
      }
    }
  }
  return { balance, players: [...players.values()], maps: [...maps.values()].map(m => {
    const times = [...m.times].sort((a, b) => a - b), mid = Math.floor(times.length / 2)
    const { times: _, ...rest } = m
    void _
    return { ...rest, measured: times.length, best: times[0], average: times.reduce((a, b) => a + b, 0) / times.length, median: times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2 }
  }) }
}

export function matchingTeamLineups<T extends { name: string; teamId: string | null }>(name: string, lineups: T[]): T[] {
  return lineups.filter(l => !l.teamId && opponentNameKey(l.name) === opponentNameKey(name))
}
