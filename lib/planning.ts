// Planning a tournament before it has lineups: who is available, and which lineups to build from them.
import { inTeam, statusAt, type PlayerStatusInfo } from "./player-status"

export type Availability = "FIX" | "MAYBE" | "OUT"

// What a player answered: one of the fixed levels, an extra level of the planning ("level:<id>"), or nothing
// yet. Without an answer a member marked as inactive counts as "INACTIVE" instead of open.
export type Answer = Availability | "OPEN" | "INACTIVE" | `level:${string}`

export const INACTIVE_LABEL = "Inactive"

export interface PlanningEntryData {
  playerId: string
  status: Availability | null
  levelId: string | null
  note: string | null
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  FIX: "Available",
  MAYBE: "Maybe",
  OUT: "Not available",
}

// inactive: the player does not drive competitions as a rule. Nobody waits for their answer,
// but one they give for a tournament counts like anyone else's.
export function answerOf(entry: Pick<PlanningEntryData, "status" | "levelId"> | undefined | null, inactive = false): Answer {
  if (entry?.status) return entry.status
  if (entry?.levelId) return `level:${entry.levelId}`
  return inactive ? "INACTIVE" : "OPEN"
}

export interface PlanningRow<P> {
  player: P
  entry: PlanningEntryData | undefined
  answer: Answer
  // Guests are only on the list because a manager added them
  guest: boolean
}

// The availability list: every team member as of the given day, plus the guests added to the planning
export function planningRows<P extends { id: string; name: string; inactive?: boolean } & PlayerStatusInfo>(
  players: P[],
  entries: PlanningEntryData[],
  day: Date | string
): Array<PlanningRow<P>> {
  const byPlayer = new Map(entries.map((e) => [e.playerId, e]))
  return players
    .map((player) => ({ player, entry: byPlayer.get(player.id), guest: !inTeam(statusAt(player, day)) }))
    .filter((row) => !row.guest || row.entry)
    .map((row) => ({ ...row, answer: answerOf(row.entry, row.player.inactive) }))
    .sort((a, b) => a.player.name.localeCompare(b.player.name))
}
