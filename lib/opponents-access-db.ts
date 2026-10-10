import { db } from "./db"
import { canManage } from "./roles"
import { mayEditLineup, LINEUP_ACCESS_SELECT, type SessionUser } from "./lineup-access-db"
export async function mayMaintainOpponent(user: SessionUser, tournamentId?: string) {
  if (canManage(user.role)) return true
  if (!user.id) return false
  const lineups = await db.tournamentLineup.findMany({ where: { ...(tournamentId && { tournamentId }), managers: { some: { userId: user.id } } }, select: LINEUP_ACCESS_SELECT })
  return lineups.some(l => mayEditLineup(user, l))
}
