import { mayEditLineup, type SessionUser } from "@/lib/lineup-access-db"
import { db } from "@/lib/db"
import { shapeSummaries, summaryInclude } from "@/lib/summary"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { guestTmIdsAt, selectable, tournamentReferenceDate, trialTmIdsAt } from "@/lib/player-status"
import { notFound, redirect } from "next/navigation"
import { matchPath } from "@/lib/paths"
import { resolveLineup, resolveMatch, resolveTournament } from "@/lib/slugs-db"
import { withCompNames } from "@/lib/player-names-db"
import { ruleSetFor } from "@/lib/match-rules"
import { compRulesOf, rulesInclude } from "@/lib/match-rules-db"
import { MatchDetailView } from "./match-detail-view"
import { matchdayPlanningEnabled } from "@/lib/features"
import { publishedLineupOf } from "@/lib/matchday-plan-db"

interface Props {
  params: Promise<{ id: string; lineup: string; match: string }>
  searchParams: Promise<{ ecm?: string }>
}

export default async function MatchDetailPage({ params, searchParams }: Props) {
  const autoEcmImport = (await searchParams).ecm === "1"
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
        tournamentLineup: { select: { id: true, slug: true, name: true, slots: { include: { player: true } }, managers: { select: { userId: true } } } },
        stage: { select: { id: true, type: true, number: true } },
        tournament: {
          include: {
            stages: { select: { id: true, type: true, number: true } },
            ...rulesInclude,
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
            ...summaryInclude,
          },
        },
      },
    }),
    db.player.findMany({ where: { isOpponentOnly: false }, orderBy: { name: "asc" }, include: { statusChanges: true } }),
  ])

  if (!match || match.tournament.id !== tournamentId) notFound()

  // Members and guests as of the tournament's start day
  const guestTmIds = guestTmIdsAt(allPlayers, tournamentReferenceDate(match.tournament))

  // Admins and managers, and whoever is responsible for the lineup of this match, may maintain its results
  const user = (session?.user as SessionUser | undefined) ?? null
  const canEdit = match.tournamentLineup
    ? mayEditLineup(user, { managers: match.tournamentLineup.managers, tournament: match.tournament })
    : canManage(user?.role)

  // Everyone is shown under the name they had when the tournament started
  const trialTmIds = trialTmIdsAt(allPlayers, tournamentReferenceDate(match.tournament))
  // Former players are still needed to recognise imported results, but are not offered for picking
  const named = await withCompNames({ match: shapeSummaries([match])[0], allPlayers: allPlayers.map((p) => ({ ...p, former: !selectable(p) })) }, match.tournament)

  // The lineup finalised in the match day planning (docs/adr/008)
  const plannedLineup = matchdayPlanningEnabled() && match.stage.type !== "SEEDING"
    ? await publishedLineupOf({ id: match.id, tournamentLineupId: match.tournamentLineupId, stageId: match.stage.id, formats: [...new Set([...match.subMatches].sort((a, b) => a.order - b.order).map((sm) => sm.format))] })
    : null

  return <MatchDetailView plannedLineup={plannedLineup} match={named.match} ruleSet={ruleSetFor(compRulesOf(match.tournament), match.stage.type)} allPlayers={named.allPlayers} guestTmIds={guestTmIds} trialTmIds={trialTmIds} autoEcmImport={autoEcmImport} canEdit={canEdit} canManage={canManage(user?.role)} />
}
