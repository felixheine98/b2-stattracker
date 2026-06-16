import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { TournamentDetailView } from "./tournament-detail-view"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TournamentDetailPage({ params }: Props) {
  const { id } = await params

  const tournament = await db.tournament.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { date: "desc" },
        include: {
          lineup: {
            include: { slots: { include: { player: true } } },
          },
          _count: { select: { rounds: true } },
        },
      },
    },
  })

  if (!tournament) notFound()

  const players = await db.player.findMany({ orderBy: { name: "asc" } })

  return <TournamentDetailView tournament={tournament} players={players} />
}
