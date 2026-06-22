import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { notFound } from "next/navigation"
import { TournamentDetailView } from "./tournament-detail-view"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TournamentDetailPage({ params }: Props) {
  const { id } = await params

  const [session, tournament, players] = await Promise.all([
    auth(),
    db.tournament.findUnique({
      where: { id },
      include: {
        matches: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { subMatches: true } },
          },
        },
        tournamentLineups: {
          orderBy: { createdAt: "asc" },
          include: { slots: { include: { player: true } } },
        },
      },
    }),
    db.player.findMany({ orderBy: { name: "asc" } }),
  ])

  if (!tournament) notFound()

  return <TournamentDetailView tournament={tournament} players={players} canManage={canManage((session?.user as { role?: string })?.role)} />
}
