import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { guestTmIdsAt, tournamentReferenceDate } from "@/lib/player-status"
import { notFound, redirect } from "next/navigation"
import { matchPath } from "@/lib/paths"
import { resolveLineup, resolveMatch, resolveTournament } from "@/lib/slugs-db"
import { withCompNames } from "@/lib/player-names-db"
import { MatchDetailView } from "./match-detail-view"

interface Props {
  params: Promise<{ id: string; lineup: string; match: string }>
}

export default async function MatchDetailPage({ params }: Props) {
  // The address holds slugs; IDs and former slugs are redirected to the current address
  const { id: tournamentParam, lineup: lineupParam, match: matchParam } = await params
  const foundTournament = await resolveTournament(tournamentParam)
  const foundLineup = foundTournament && (await resolveLineup(foundTournament.id, lineupParam))
  const foundMatch = foundLineup && (await resolveMatch(foundLineup.id, matchParam))
  if (!foundTournament || !foundLineup || !foundMatch) notFound()
  if (tournamentParam !== foundTournament.slug || lineupParam !== foundLineup.slug || matchParam !== foundMatch.slug) {
    redirect(matchPath(foundTournament, foundLineup, foundMatch))
  }
  const tournamentId = foundTournament.id
  const matchId = foundMatch.id

  const [session, match, allPlayers] = await Promise.all([
    auth(),
    db.match.findUnique({
      where: { id: matchId },
      include: {
        tournamentLineup: { select: { id: true, slug: true, name: true, slots: { include: { player: true } } } },
        stage: { select: { id: true, type: true, number: true } },
        tournament: {
          include: {
            stages: { select: { id: true, type: true, number: true } },
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

  // Everyone is shown under the name they had when the tournament started
  const named = await withCompNames({ match, allPlayers }, match.tournament)

  return <MatchDetailView match={named.match} allPlayers={named.allPlayers} guestTmIds={guestTmIds} canManage={canManage((session?.user as { role?: string })?.role)} />
}
