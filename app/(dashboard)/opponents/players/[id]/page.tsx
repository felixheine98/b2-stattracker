import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { opponentMatchInclude } from "@/lib/opponents-db"
import { opponentStats } from "@/lib/opponents"
import { canManage } from "@/lib/roles"
import { OpponentPlayerProfile } from "@/components/opponents/opponent-player-profile"
import type { HistoryMatch } from "@/components/opponents/types"
export default async function OpponentPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [session, player, matches] = await Promise.all([
    auth(), db.player.findUnique({ where: { id } }),
    db.match.findMany({ where: { subMatches: { some: { rounds: { some: { results: { some: { playerId: id, isOurTeam: false } } } } } } }, include: opponentMatchInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
  ])
  if (!player) notFound()
  const all = opponentStats(matches)
  const stats = { ...all, players: all.players.filter(p => p.playerId === id), maps: all.maps.filter(p => p.playerId === id) }
  return <OpponentPlayerProfile player={player} stats={stats} matches={matches as HistoryMatch[]} canAssign={canManage((session?.user as { role?: string })?.role)} />
}
