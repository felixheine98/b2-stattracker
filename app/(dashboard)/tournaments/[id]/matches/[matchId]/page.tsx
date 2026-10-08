import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { guestTmIdsAt, tournamentReferenceDate } from "@/lib/player-status"
import { notFound } from "next/navigation"
import { MatchDetailView } from "./match-detail-view"

interface Props {
  params: Promise<{ id: string; matchId: string }>
}

export default async function MatchDetailPage({ params }: Props) {
  const { id: tournamentId, matchId } = await params

  const [session, match, allPlayers] = await Promise.all([
    auth(),
    db.match.findUnique({
      where: { id: matchId },
      include: {
        tournamentLineup: { select: { id: true, name: true, slots: { include: { player: true } } } },
        tournament: {
          include: {
            tournamentLineups: {
              orderBy: { createdAt: "asc" },
              include: { slots: { include: { player: true } } },
            },
          },
        },
        subMatches: {
          orderBy: { order: "asc" },
          include: {
            lineup: { include: { slots: { include: { player: true } } } },
            rounds: {
              orderBy: { number: "asc" },
              include: {
                results: {
                  orderBy: [{ position: "asc" }, { timeMs: "asc" }],
                  include: { player: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    }),
    db.player.findMany({ orderBy: { name: "asc" }, include: { statusChanges: true } }),
  ])

  if (!match || match.tournament.id !== tournamentId) notFound()

  // Members and guests as of the tournament's start day
  const guestTmIds = guestTmIdsAt(allPlayers, tournamentReferenceDate(match.tournament))

  return <MatchDetailView match={match} allPlayers={allPlayers} guestTmIds={guestTmIds} canManage={canManage((session?.user as { role?: string })?.role)} />
}
