// Team members and guests. A player has an initial status "from the beginning" plus dated
// switches. Inside a tournament the status on the tournament's start day counts, so a
// player is either member or guest for the whole tournament.

export type PlayerStatus = "MEMBER" | "GUEST"

export interface StatusChange {
  id: string
  status: PlayerStatus
  effectiveFrom: Date | string
}

export interface PlayerStatusInfo {
  initialStatus: PlayerStatus
  statusChanges: StatusChange[]
}

// Calendar day as YYYY-MM-DD, used for all comparisons so time of day never matters
export function dayKey(date: Date | string): string {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10)
}

// Today in the browser's time zone, for date field defaults and limits
export function localTodayKey(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// True for a real calendar day written as YYYY-MM-DD (rejects 2026-02-31 and the like)
export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && dayKey(date) === value
}

export function sortedChanges(player: PlayerStatusInfo): StatusChange[] {
  return [...player.statusChanges].sort((a, b) => dayKey(a.effectiveFrom).localeCompare(dayKey(b.effectiveFrom)))
}

// A switch counts from its own day on, so a tournament starting that day uses the new status
export function statusAt(player: PlayerStatusInfo, date: Date | string): PlayerStatus {
  const day = dayKey(date)
  let status = player.initialStatus
  for (const change of sortedChanges(player)) {
    if (dayKey(change.effectiveFrom) > day) break
    status = change.status
  }
  return status
}

// Switches cannot be dated in the future, so the latest one is the status right now.
// Deliberately independent of the clock: server and browser may disagree on "today".
export function currentStatus(player: PlayerStatusInfo): PlayerStatus {
  return sortedChanges(player).at(-1)?.status ?? player.initialStatus
}

// The day that decides member/guest inside a tournament
export function tournamentReferenceDate(tournament: { startDate?: Date | string | null; createdAt: Date | string }): Date | string {
  return tournament.startDate ?? tournament.createdAt
}

// Lower-cased TM IDs of everyone who is a guest on the given day
export function guestTmIdsAt(players: Array<PlayerStatusInfo & { tmId: string }>, date: Date | string): string[] {
  return players.filter((p) => statusAt(p, date) === "GUEST").map((p) => p.tmId.toLowerCase())
}

export function formatDay(date: Date | string): string {
  const [year, month, day] = dayKey(date).split("-")
  return `${day}.${month}.${year}`
}
