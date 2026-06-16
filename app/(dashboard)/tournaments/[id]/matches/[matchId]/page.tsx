import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { MatchDetailView } from "./match-detail-view"

interface Props {
  params: Promise<{ id: string; matchId: string }>
}

export default async function MatchDetailPage({ params }: Props) {
  const { id: tournamentId, matchId } = await params

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { id: true, name: true, format: true } },
      lineup: {
        include: { slots: { include: { player: true } } },
      },
      rounds: {
        orderBy: { number: "asc" },
        include: {
          results: {
            orderBy: { timeMs: "asc" },
            include: { player: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  if (!match || match.tournament.id !== tournamentId) notFound()

  const allPlayers = await db.player.findMany({ orderBy: { name: "asc" } })

  return <MatchDetailView match={match} allPlayers={allPlayers} />
}
