import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { PlayersView } from "./players-view"

export default async function PlayersPage() {
  const [session, players, users] = await Promise.all([
    auth(),
    db.player.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
        _count: { select: { roundResults: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      select: { id: true, name: true, username: true, playerId: true },
      orderBy: { name: "asc" },
    }),
  ])

  const role = (session?.user as { role?: string })?.role
  return <PlayersView players={players} users={users} canManage={canManage(role)} />
}
