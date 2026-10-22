import type { Format } from "@/types"
import { teamSize } from "./utils"
// The lineup planning of one match day (docs/adr/008): who of the lineup is available, and who
// drives which format in each match. A variant holds a day lineup per format, which every match
// of the stage follows unless it has a lineup of its own for that format.

export type MatchdayAnswer = "FIX" | "PARTIAL" | "MAYBE" | "OUT"

// The players to choose from: fixed and partly available ones on top, maybe and unanswered
// ones below (still to be picked), and those who are out, who cannot be picked
export function planPool<P extends { id: string }>(kader: P[], answers: Record<string, MatchdayAnswer | undefined>): { top: P[]; below: P[]; out: P[] } {
  const pool = { top: [] as P[], below: [] as P[], out: [] as P[] }
  for (const player of kader) {
    const answer = answers[player.id]
    if (answer === "FIX" || answer === "PARTIAL") pool.top.push(player)
    else if (answer === "OUT") pool.out.push(player)
    else pool.below.push(player)
  }
  return pool
}

// Player IDs per place of a format; null is a place still open
export type Seats = Partial<Record<Format, Array<string | null>>>

export interface PlanVariant {
  // The day lineup, which every match follows
  day: Seats
  // Formats of single matches that have a lineup of their own, by match ID
  matches: Record<string, Seats>
}

export interface PlanMatch {
  id: string
  // The formats of its sub-matches
  formats: readonly Format[]
}

// The places of a format, as many as it needs drivers
function fit(seats: Array<string | null>, format: Format): Array<string | null> {
  const size = teamSize(format) ?? seats.length
  return Array.from({ length: size }, (_, i) => seats[i] ?? null)
}

// Who drives which format in a match: the match's own lineup for a format, otherwise the day lineup
export function matchLineup(variant: PlanVariant, match: PlanMatch): Seats {
  const lineup: Seats = {}
  const own = variant.matches[match.id] ?? {}
  for (const format of match.formats) lineup[format] = fit(own[format] ?? variant.day[format] ?? [], format)
  return lineup
}

// A planned player who is not there for a match
export interface PlanAbsence {
  playerId: string
  matchId: string
}

export type PlanHint =
  | { matchId: string; format: Format; kind: "open"; count: number }
  | { matchId: string; format: Format; kind: "out" | "absent"; playerId: string }

// What is not right yet with the lineups of the matches; finalising is possible all the same
export function planHints(variant: PlanVariant, matches: PlanMatch[], answers: Record<string, MatchdayAnswer | undefined>, absences: PlanAbsence[]): PlanHint[] {
  const hints: PlanHint[] = []
  for (const match of matches) {
    const lineup = matchLineup(variant, match)
    for (const format of match.formats) {
      const open = lineup[format]!.filter((id) => id === null).length
      if (open > 0) hints.push({ matchId: match.id, format, kind: "open", count: open })
      for (const playerId of lineup[format]!) {
        if (playerId === null) continue
        if (answers[playerId] === "OUT") hints.push({ matchId: match.id, format, kind: "out", playerId })
        else if (absences.some((a) => a.playerId === playerId && a.matchId === match.id)) hints.push({ matchId: match.id, format, kind: "absent", playerId })
      }
    }
  }
  return hints
}

// What finalising publishes: the lineup of every match as it stands, and the day lineup for
// matches added later. It reads like a variant, so matchLineup gives the published lineups.
export function publishedSnapshot(variant: PlanVariant, matches: PlanMatch[]): PlanVariant {
  const copy = (seats: Seats): Seats => Object.fromEntries(Object.entries(seats).map(([format, ids]) => [format, [...(ids ?? [])]]))
  return { day: copy(variant.day), matches: Object.fromEntries(matches.map((m) => [m.id, matchLineup(variant, m)])) }
}

const sameSeats = (a: Seats, b: Seats) => {
  const formats = new Set([...Object.keys(a), ...Object.keys(b)] as Format[])
  const filled = (seats: Seats, format: Format) => JSON.stringify((seats[format] ?? []).filter((id) => id !== null))
  return [...formats].every((format) => filled(a, format) === filled(b, format))
}

// Whether the planning differs from what was published: in the day lineup or in the lineup of a match
export function hasUnpublishedChanges(snapshot: PlanVariant, variant: PlanVariant, matches: PlanMatch[]): boolean {
  if (!sameSeats(snapshot.day, variant.day)) return true
  return matches.some((m) => !sameSeats(matchLineup(snapshot, m), matchLineup(variant, m)))
}
