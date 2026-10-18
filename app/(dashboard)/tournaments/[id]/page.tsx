import { openPlanningsFor } from "@/lib/planning-db"
import { LINEUP_MANAGERS_INCLUDE } from "@/lib/lineup-access-db"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { notFound, redirect } from "next/navigation"
import { tournamentPath } from "@/lib/paths"
import { resolveTournament } from "@/lib/slugs-db"
import { withCompNames } from "@/lib/player-names-db"
import { matchRulesEnabled } from "@/lib/features"
import { TournamentDetailView } from "./tournament-detail-view"
import { getTfhRace } from "@/lib/tfh-db"
import { TfhRaceView } from "@/components/tfh/race-view"
import { lineupPoints } from "@/lib/match-rules"
import { compRulesOf, rulesBodies, rulesInclude } from "@/lib/match-rules-db"

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
  const tfh = await getTfhRace(id)
  if (tfh) {
    const session = await auth()
    return <TfhRaceView race={tfh} isAdmin={(session?.user as { role?: string })?.role === "ADMIN"} />
  }

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
        ...rulesInclude,
        tournamentLineups: {
          orderBy: { createdAt: "asc" },
          include: { slots: { include: { player: true } }, ...LINEUP_MANAGERS_INCLUDE },
        },
      },
    }),
    db.player.findMany({ where: { isOpponentOnly: false }, orderBy: { name: "asc" }, include: { statusChanges: true } }),
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

  const mayManage = canManage((session?.user as { role?: string })?.role)
  // Accounts to choose the people responsible for a lineup from
  const users = mayManage
    ? await db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, username: true, role: true, playerId: true } })
    : []

  // The lineup the signed-in user plays in, if any: the stats start out filtered to it
  const userId = (session?.user as { id?: string })?.id
  const self = userId ? await db.user.findUnique({ where: { id: userId }, select: { playerId: true } }) : null
  // A running planning asks the signed-in player whether they take part
  const planningCard = self?.playerId ? (await openPlanningsFor(self.playerId, id))[0] ?? null : null
  const hasPlanning = (await db.planning.count({ where: { tournamentId: id } })) > 0
  const ownLineupId = self?.playerId
    ? tournament.tournamentLineups.find((l) => l.slots.some((s) => s.playerId === self.playerId))?.id ?? null
    : null

  // Everyone is shown under the name they had when the tournament started
  const named = await withCompNames({ tournament, players, statsMatches }, tournament)

  // Points of each lineup from the group stage, where the format rules give any
  const rules = compRulesOf(tournament)
  const points = Object.fromEntries(
    tournament.tournamentLineups.flatMap((l) => {
      const sum = lineupPoints(statsMatches.filter((m) => m.tournamentLineupId === l.id).map((m) => ({ ...m, stageType: m.stage.type })), rules)
      return sum === null ? [] : [[l.id, sum]]
    }),
  )

  return <TournamentDetailView lineupPoints={points} tournament={{ ...named.tournament, ...rulesBodies(rules) }} players={named.players} statsMatches={named.statsMatches} users={users} ownLineupId={ownLineupId} hasPlanning={hasPlanning} planningCard={planningCard} canManage={mayManage} matchRules={matchRulesEnabled()} />
}
