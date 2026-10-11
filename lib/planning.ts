// Planning a tournament before it has lineups: who is available, and which lineups to build from them.
import { statusAt, type PlayerStatusInfo } from "./player-status"

export type Availability = "FIX" | "MAYBE" | "OUT"

// What a player answered: one of the fixed levels, an extra level of the planning ("level:<id>"), or nothing yet
export type Answer = Availability | "OPEN" | `level:${string}`

export interface PlanningEntryData {
  playerId: string
  status: Availability | null
  levelId: string | null
  note: string | null
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  FIX: "fix dabei",
  MAYBE: "vielleicht",
  OUT: "nicht dabei",
}

export function answerOf(entry: Pick<PlanningEntryData, "status" | "levelId"> | undefined | null): Answer {
  if (entry?.status) return entry.status
  if (entry?.levelId) return `level:${entry.levelId}`
  return "OPEN"
}

export interface PlanningRow<P> {
  player: P
  entry: PlanningEntryData | undefined
  answer: Answer
  // Guests are only on the list because a manager added them
  guest: boolean
}

// The availability list: every team member as of the given day, plus the guests added to the planning
export function planningRows<P extends { id: string; name: string } & PlayerStatusInfo>(
  players: P[],
  entries: PlanningEntryData[],
  day: Date | string
): Array<PlanningRow<P>> {
  const byPlayer = new Map(entries.map((e) => [e.playerId, e]))
  return players
    .map((player) => ({ player, entry: byPlayer.get(player.id), guest: statusAt(player, day) === "GUEST" }))
    .filter((row) => !row.guest || row.entry)
    .map((row) => ({ ...row, answer: answerOf(row.entry) }))
    .sort((a, b) => a.player.name.localeCompare(b.player.name))
}
