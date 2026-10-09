import { LINEUP_MANAGERS_INCLUDE, mayEditLineup, type SessionUser } from "@/lib/lineup-access-db"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { guestTmIdsAt, tournamentReferenceDate } from "@/lib/player-status"
import { notFound, redirect } from "next/navigation"
import { lineupPath } from "@/lib/paths"
import { resolveLineup, resolveTournament } from "@/lib/slugs-db"
import { withCompNames } from "@/lib/player-names-db"
import { LineupMatchesView } from "./lineup-matches-view"

interface Props {
  params: Promise<{ id: string; lineup: string }>
}

export default async function LineupMatchesPage({ params }: Props) {
  // The address holds slugs; IDs and former slugs are redirected to the current address
  const { id: tournamentParam, lineup: lineupParam } = await params
  const foundTournament = await resolveTournament(tournamentParam)
  const foundLineup = foundTournament && (await resolveLineup(foundTournament.id, lineupParam))
  if (!foundTournament || !foundLineup) notFound()
  if (tournamentParam !== foundTournament.slug || lineupParam !== foundLineup.slug) redirect(lineupPath(foundTournament, foundLineup))
  const tournamentId = foundTournament.id
  const lineupId = foundLineup.id

  const [session, lineup, players] = await Promise.all([
    auth(),
    db.tournamentLineup.findUnique({
      where: { id: lineupId, tournamentId },
      include: {
        tournament: {
          select: { id: true, slug: true, name: true, formats: true, startDate: true, endDate: true, createdAt: true, stages: { select: { id: true, type: true, number: true } } },
        },
        slots: { include: { player: true } },
        ...LINEUP_MANAGERS_INCLUDE,
        matches: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { subMatches: true } },
            stage: { select: { id: true, type: true, number: true } },
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

  // Everyone is shown under the name they had when the tournament started
  const named = await withCompNames(lineup, lineup.tournament)

  // Admins and managers may do everything; whoever is responsible for this lineup may add matches and results
  const user = (session?.user as SessionUser | undefined) ?? null
  const responsible = !!user?.id && lineup.managers.some((m) => m.user.id === user.id)
  const canEdit = mayEditLineup(user, { managers: lineup.managers.map((m) => ({ userId: m.user.id })), tournament: lineup.tournament })

  return (
    <LineupMatchesView
      lineup={named}
      guestTmIds={guestTmIds}
      canManage={canManage(user?.role)}
      canEdit={canEdit}
      // Responsible for the lineup, but the week after the tournament's end is over
      editExpired={responsible && !canEdit}
    />
  )
}
