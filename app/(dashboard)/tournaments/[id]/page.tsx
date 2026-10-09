import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { notFound, redirect } from "next/navigation"
import { tournamentPath } from "@/lib/paths"
import { resolveTournament } from "@/lib/slugs-db"
import { withCompNames } from "@/lib/player-names-db"
import { TournamentDetailView } from "./tournament-detail-view"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TournamentDetailPage({ params }: Props) {
  // The address holds the tournament's slug; an ID or a former slug is redirected to it
  const { id: param } = await params
  const found = await resolveTournament(param)
  if (!found) notFound()
  if (param !== found.slug) redirect(tournamentPath(found))
  const id = found.id

  const [session, tournament, players, statsMatches] = await Promise.all([
    auth(),
    db.tournament.findUnique({
      where: { id },
      include: {
        matches: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { subMatches: true } },
            tournamentLineup: { select: { name: true } },
            stage: { select: { id: true, type: true, number: true } },
          },
        },
        stages: { select: { id: true, type: true, number: true } },
        tournamentLineups: {
          orderBy: { createdAt: "asc" },
          include: { slots: { include: { player: true } } },
        },
      },
    }),
    db.player.findMany({ orderBy: { name: "asc" }, include: { statusChanges: true } }),
    db.match.findMany({
      where: { tournamentId: id },
      include: {
        stage: { select: { id: true, type: true } },
        subMatches: {
          include: {
            rounds: {
              orderBy: { number: "asc" },
              include: { results: { orderBy: [{ position: "asc" }, { timeMs: "asc" }] } },
            },
          },
        },
      },
    }),
  ])

  if (!tournament) notFound()

  // Everyone is shown under the name they had when the tournament started
  const named = await withCompNames({ tournament, players, statsMatches }, tournament)

  return <TournamentDetailView tournament={named.tournament} players={named.players} statsMatches={named.statsMatches} canManage={canManage((session?.user as { role?: string })?.role)} />
}
