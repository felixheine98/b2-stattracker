import type { Format } from "@/types"
import { formatLabel, teamSize } from "./utils"
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

// Puts a player on a place of a format. A player already driving the format swaps places with
// the one there; a player from outside the format takes the place.
export function placePlayer(seats: Seats, format: Format, index: number, playerId: string | null): Seats {
  const places = fit(seats[format] ?? [], format)
  const from = playerId ? places.indexOf(playerId) : -1
  if (from >= 0) places[from] = places[index]
  places[index] = playerId
  return { ...seats, [format]: places }
}

// The players offered while typing into a place: names containing the typed text, those starting
// with it first, then available players before maybe and unanswered ones. Players who are out or
// already drive the format are not offered.
export function seatSuggestions<P extends { id: string; name: string; nickname?: string | null }>(
  query: string,
  kader: P[],
  answers: Record<string, MatchdayAnswer | undefined>,
  taken: Array<string | null>
): P[] {
  const text = query.trim().toLowerCase()
  const { top, below } = planPool(kader, answers)
  // Found by the gamertag as well as by the nickname
  const names = (p: P) => [p.name, ...(p.nickname ? [p.nickname] : [])].map((n) => n.toLowerCase())
  const rank = (p: P) => (names(p).some((n) => n.startsWith(text)) ? 0 : 1)
  return [...top, ...below]
    .filter((p) => !taken.includes(p.id) && names(p).some((n) => n.includes(text)))
    .sort((a, b) => rank(a) - rank(b))
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

export interface PlanDriver {
  // Trackmania account ID, in any case
  tmId: string
  name: string
}

// Where a match was driven otherwise than finalised, per format, for the preview of an import:
// "2v2: planned Toast, driven Ente". Only a hint: deviating from the plan is mostly on purpose.
export function planDeviations(planned: Partial<Record<Format, PlanDriver[]>>, driven: Array<{ format: Format; drivers: PlanDriver[] }>): string[] {
  const key = (d: PlanDriver) => d.tmId.toLowerCase()
  const lines = driven.flatMap(({ format, drivers }) => {
    const plan = planned[format]
    if (!plan?.length) return []
    const missing = plan.filter((p) => !drivers.some((d) => key(d) === key(p)))
    const extra = drivers.filter((d) => !plan.some((p) => key(p) === key(d)))
    if (missing.length === 0 && extra.length === 0) return []
    const names = (list: PlanDriver[]) => list.map((d) => d.name).join(", ")
    const text = missing.length === 0 ? `also driven ${names(extra)}` : extra.length === 0 ? `planned ${names(missing)}, not driven` : `planned ${names(missing)}, driven ${names(extra)}`
    return [`${formatLabel(format)}: ${text}`]
  })
  return [...new Set(lines)]
}
