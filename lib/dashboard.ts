// What the dashboard shows about tournaments: which ones are current, how each lineup stands,
// and who drove best. Seeding matches are left out, as in all stats.
import type { StatsMatch } from "./format-stats"
import { suggestMatchOutcome } from "./opponents"
import { dayKey } from "./player-status"
import { roundPlacements, roundScore } from "./round-score"

export interface DashMatch extends Omit<StatsMatch, "tournamentLineupId"> {
  tournamentLineupId: string | null
  opponent?: string | null
  date?: Date | string | null
  createdAt: Date | string
  // Set once the match is closed with a confirmed result (W, L or D)
  closedAt?: Date | string | null
  confirmedOutcome?: string | null
}

type Outcome = "W" | "L" | "D"

interface TeamRecord {
  matchesWon: number
  matchesDrawn: number
  matchesLost: number
  mapsWon: number
  mapsDrawn: number
  mapsLost: number
  roundsWon: number
  roundsLost: number
}

export interface LineupRecord extends TeamRecord {
  lineupId: string
  // The match played last; confirmed tells a closed match from a result that is only worked out
  lastMatch: { id: string; opponent: string | null; outcome: Outcome | null; confirmed: boolean; mapsWon: number; mapsLost: number } | null
}

const emptyRecord = (): TeamRecord => ({ matchesWon: 0, matchesDrawn: 0, matchesLost: 0, mapsWon: 0, mapsDrawn: 0, mapsLost: 0, roundsWon: 0, roundsLost: 0 })

interface Tally {
  mapsWon: number
  mapsDrawn: number
  mapsLost: number
  roundsWon: number
  roundsLost: number
  // Had at least one round with both teams
  played: boolean
}

function tally(match: DashMatch): Tally {
  const t: Tally = { mapsWon: 0, mapsDrawn: 0, mapsLost: 0, roundsWon: 0, roundsLost: 0, played: false }
  for (const sm of match.subMatches) {
    let won = 0, lost = 0, scored = false
    for (const round of sm.rounds) {
      const outcome = roundScore(round.results)?.outcome
      if (!outcome) continue
      scored = true
      if (outcome === "W") won++
      else if (outcome === "L") lost++
    }
    if (!scored) continue
    t.played = true
    t.roundsWon += won
    t.roundsLost += lost
    if (won > lost) t.mapsWon++
    else if (lost > won) t.mapsLost++
    else t.mapsDrawn++
  }
  return t
}

// The result of a match: the one confirmed when closing it, otherwise the one its sub-matches give
function outcomeOf(match: DashMatch): { outcome: Outcome | null; confirmed: boolean } {
  const confirmed = match.closedAt && (match.confirmedOutcome === "W" || match.confirmedOutcome === "L" || match.confirmedOutcome === "D")
  if (confirmed) return { outcome: match.confirmedOutcome as Outcome, confirmed: true }
  return { outcome: suggestMatchOutcome(match.subMatches), confirmed: false }
}

function add(record: TeamRecord, match: DashMatch, t: Tally): void {
  const { outcome } = outcomeOf(match)
  if (outcome === "W") record.matchesWon++
  else if (outcome === "L") record.matchesLost++
  else if (outcome === "D") record.matchesDrawn++
  record.mapsWon += t.mapsWon
  record.mapsDrawn += t.mapsDrawn
  record.mapsLost += t.mapsLost
  record.roundsWon += t.roundsWon
  record.roundsLost += t.roundsLost
}

const counted = (match: DashMatch) => match.stage.type !== "SEEDING"
const playedAt = (match: DashMatch) => new Date(match.date ?? match.createdAt).getTime()

// How each of the given lineups stands, in their order
export function lineupRecords(matches: DashMatch[], lineupIds: string[]): LineupRecord[] {
  return lineupIds.map((lineupId) => {
    const record: LineupRecord = { lineupId, ...emptyRecord(), lastMatch: null }
    let last: DashMatch | null = null
    for (const match of matches) {
      if (match.tournamentLineupId !== lineupId || !counted(match)) continue
      const t = tally(match)
      const closed = outcomeOf(match).confirmed
      if (!t.played && !closed) continue
      add(record, match, t)
      if (!last || playedAt(match) >= playedAt(last)) last = match
    }
    if (last) {
      const t = tally(last)
      record.lastMatch = { id: last.id, opponent: last.opponent ?? null, ...outcomeOf(last), mapsWon: t.mapsWon, mapsLost: t.mapsLost }
    }
    return record
  })
}

// The record over all the given matches, whatever the lineup
export function overallRecord(matches: DashMatch[]): TeamRecord {
  const record = emptyRecord()
  for (const match of matches) {
    if (!counted(match)) continue
    const t = tally(match)
    if (t.played || outcomeOf(match).confirmed) add(record, match, t)
  }
  return record
}

export interface Performer {
  tmId: string
  name: string
  currentName?: string
  // Lineup the player drove most of the rounds for
  lineupId: string | null
  // Average placement over the rounds driven; a round not finished is the last place
  avgPlace: number
  rounds: number
}

// Whoever of ours placed best on average over the given matches; nobody without a round.
// Formats differ in the size of the field (second place is last in a 1v1 and nearly the best
// in a 4v4), so players are compared by where in the field they finished: 0 for first, 1 for last.
// Of two who placed equally well the one with more rounds wins. minRoundShare leaves out whoever
// drove less than that share of the rounds of the busiest player: within a single match a
// 1v1 of three rounds would otherwise beat a whole evening of 4v4.
export function bestPerformer(matches: DashMatch[], { minRoundShare = 0 }: { minRoundShare?: number } = {}): Performer | null {
  const players = new Map<string, { name: string; currentName?: string; placeSum: number; shareSum: number; rounds: number; lineups: Map<string, number> }>()
  for (const match of matches) {
    if (!counted(match)) continue
    for (const sm of match.subMatches) {
      for (const round of sm.rounds) {
        const placements = roundPlacements(round.results)
        const field = round.results.length
        round.results.forEach((r, i) => {
          if (!r.isOurTeam) return
          const player = players.get(r.tmId) ?? { name: r.playerName, currentName: r.currentName, placeSum: 0, shareSum: 0, rounds: 0, lineups: new Map() }
          player.placeSum += placements[i]
          player.shareSum += field > 1 ? (placements[i] - 1) / (field - 1) : 0
          player.rounds++
          if (match.tournamentLineupId) player.lineups.set(match.tournamentLineupId, (player.lineups.get(match.tournamentLineupId) ?? 0) + 1)
          players.set(r.tmId, player)
        })
      }
    }
  }
  const mostRounds = Math.max(0, ...[...players.values()].map((p) => p.rounds))
  let top: (Performer & { share: number }) | null = null
  for (const [tmId, player] of players) {
    if (player.rounds < mostRounds * minRoundShare) continue
    const share = player.shareSum / player.rounds
    if (top && (share > top.share || (share === top.share && player.rounds <= top.rounds))) continue
    const lineupId = [...player.lineups.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    top = { tmId, name: player.name, currentName: player.currentName, lineupId, avgPlace: player.placeSum / player.rounds, rounds: player.rounds, share }
  }
  if (!top) return null
  return { tmId: top.tmId, name: top.name, currentName: top.currentName, lineupId: top.lineupId, avgPlace: top.avgPlace, rounds: top.rounds }
}

// The stage played last: the last one in playing order (stageOrder) with a round that counts
export function latestStageId(matches: DashMatch[], stageOrder: string[]): string | null {
  const played = new Set(matches.filter((m) => counted(m) && tally(m).played).map((m) => m.stage.id))
  return [...stageOrder].reverse().find((id) => played.has(id)) ?? null
}

interface DatedTournament {
  id: string
  startDate: Date | string | null
  endDate: Date | string | null
  createdAt: Date | string
  lineupCount: number
}

// The tournaments the dashboard shows: every one that is running today (it has lineups and
// today lies within its dates; without an end date from its start on), the one that started
// last first, and the one that ended most recently. Tournaments still being planned are not among them.
export function dashboardTournaments<T extends DatedTournament>(tournaments: T[], today: Date | string): { current: T[]; last: T | null } {
  const day = dayKey(today)
  const start = (t: T) => dayKey(t.startDate ?? t.createdAt)
  const started = tournaments.filter((t) => t.lineupCount > 0 && start(t) <= day)
  const current = started
    .filter((t) => !t.endDate || dayKey(t.endDate) >= day)
    .sort((a, b) => start(b).localeCompare(start(a)))
  const ended = started.filter((t) => t.endDate && dayKey(t.endDate) < day)
  const last = ended.sort((a, b) => dayKey(b.endDate!).localeCompare(dayKey(a.endDate!)))[0] ?? null
  return { current, last }
}
