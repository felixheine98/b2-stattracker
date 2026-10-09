import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canEditLineup } from "@/lib/lineup-access"
import { dayKey } from "@/lib/player-status"
import { canManage } from "@/lib/roles"

export interface SessionUser {
  id?: string
  role?: string
}

export async function sessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  return session ? (session.user as SessionUser) : null
}

// What deciding about a lineup needs: who is responsible for it and when its tournament ends
export const LINEUP_ACCESS_SELECT = {
  managers: { select: { userId: true } },
  tournament: { select: { startDate: true, endDate: true, createdAt: true, stages: { select: { type: true, number: true } } } },
} as const

type LineupAccessData = {
  managers: Array<{ userId: string }>
  tournament: Parameters<typeof canEditLineup>[2]
}

// May this user maintain the matches and results of the lineup (today)?
export function mayEditLineup(user: SessionUser | null, lineup: LineupAccessData): boolean {
  return canEditLineup(user, { managerUserIds: lineup.managers.map((m) => m.userId) }, lineup.tournament, dayKey(new Date()))
}

// The same by ID. A match without lineup (there should be none) is for admins and managers only.
export async function mayEditLineupById(user: SessionUser | null, lineupId: string | null | undefined): Promise<boolean> {
  if (!user) return false
  if (canManage(user.role)) return true
  if (!lineupId) return false
  const lineup = await db.tournamentLineup.findUnique({ where: { id: lineupId }, select: LINEUP_ACCESS_SELECT })
  return !!lineup && mayEditLineup(user, lineup)
}

// The accounts responsible for a lineup, as shown on the pages
export const LINEUP_MANAGERS_INCLUDE = {
  managers: {
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, name: true, username: true, role: true, playerId: true } } },
  },
} as const
