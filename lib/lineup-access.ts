// Who may maintain the matches and results of a lineup. Admins and managers always may; an
// account assigned to the lineup (a "lineup manager") may until a week after the tournament ended.
import { dayKey } from "./player-status"
import { canManage } from "./roles"
import { sortStages, stageDate, type StageType } from "./stages"

interface TournamentDates {
  startDate?: Date | string | null
  endDate?: Date | string | null
  createdAt: Date | string
  stages: Array<{ type: StageType; number: number }>
}

const GRACE_DAYS = 7

// The entered end date, or the day of the last stage when none is entered
export function tournamentEndDay(tournament: TournamentDates): string {
  if (tournament.endDate) return dayKey(tournament.endDate)
  const start = new Date(tournament.startDate ?? tournament.createdAt)
  const last = sortStages(tournament.stages).at(-1)
  return dayKey(last ? stageDate(last, tournament.stages, start) : start)
}

// Last day on which a lineup manager may still change results
export function lineupEditDeadline(tournament: TournamentDates): string {
  const end = new Date(`${tournamentEndDay(tournament)}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + GRACE_DAYS)
  return dayKey(end)
}

export function canEditLineup(
  user: { id?: string | null; role?: string | null } | null | undefined,
  lineup: { managerUserIds: string[] },
  tournament: TournamentDates,
  today: string
): boolean {
  if (!user) return false
  if (canManage(user.role)) return true
  return !!user.id && lineup.managerUserIds.includes(user.id) && today <= lineupEditDeadline(tournament)
}
