import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { guestTmIdsAt, tournamentReferenceDate } from "@/lib/player-status"
import { notFound } from "next/navigation"
import { LineupMatchesView } from "./lineup-matches-view"

interface Props {
  params: Promise<{ id: string; lineupId: string }>
}

export default async function LineupMatchesPage({ params }: Props) {
  const { id: tournamentId, lineupId } = await params

  const [session, lineup, players] = await Promise.all([
    auth(),
    db.tournamentLineup.findUnique({
      where: { id: lineupId, tournamentId },
      include: {
        tournament: { select: { id: true, name: true, formats: true, startDate: true, createdAt: true } },
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
    db.player.findMany({ select: { tmId: true, initialStatus: true, statusChanges: true } }),
  ])

  if (!lineup) notFound()

  // Members and guests as of the tournament's start day
  const guestTmIds = guestTmIdsAt(players, tournamentReferenceDate(lineup.tournament))

  return <LineupMatchesView lineup={lineup} guestTmIds={guestTmIds} canManage={canManage((session?.user as { role?: string })?.role)} />
}
