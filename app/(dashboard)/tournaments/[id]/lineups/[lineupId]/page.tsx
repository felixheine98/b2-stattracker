import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { notFound } from "next/navigation"
import { LineupMatchesView } from "./lineup-matches-view"

interface Props {
  params: Promise<{ id: string; lineupId: string }>
}

export default async function LineupMatchesPage({ params }: Props) {
  const { id: tournamentId, lineupId } = await params

  const [session, lineup] = await Promise.all([
    auth(),
    db.tournamentLineup.findUnique({
      where: { id: lineupId, tournamentId },
      include: {
        tournament: { select: { id: true, name: true } },
        slots: { include: { player: true } },
        matches: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { subMatches: true } },
            subMatches: {
              orderBy: { order: "asc" },
              include: {
                rounds: {
                  orderBy: { number: "asc" },
                  include: { results: { orderBy: [{ position: "asc" }, { timeMs: "asc" }] } },
                },
              },
            },
          },
        },
      },
    }),
  ])

  if (!lineup) notFound()

  return <LineupMatchesView lineup={lineup} />
}
