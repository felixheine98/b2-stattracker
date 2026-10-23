import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { canManage } from "@/lib/roles"
import { mayMaintainOpponent } from "@/lib/opponents-access-db"
import { opponentMatchInclude, rosterInclude } from "@/lib/opponents-db"
import { relatedLineupIds } from "@/lib/opponents"
import { shapeSummaries, summaryInclude } from "@/lib/summary"
import { OpponentProfile } from "@/components/opponents/opponent-profile"
import type { HistoryMatch, LineupData, OpponentChoices, TeamData } from "@/components/opponents/types"
export default async function OpponentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { id } = await params, { kind } = await searchParams
  const [session, lineup, team, teams, lineups, tournaments, players] = await Promise.all([
    auth(), kind === "team" ? null : db.opponentLineup.findUnique({ where: { id }, include: { ...rosterInclude, tournament: { select: { id: true, name: true } }, team: { include: rosterInclude } } }),
    db.opponentTeam.findUnique({ where: { id }, include: rosterInclude }),
    db.opponentTeam.findMany({ include: rosterInclude, orderBy: { name: "asc" } }),
    db.opponentLineup.findMany({ include: { ...rosterInclude, tournament: { select: { id: true, name: true } }, team: { select: { id: true, name: true, logo: true } } }, orderBy: { createdAt: "asc" } }),
    db.tournament.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    db.player.findMany({ select: { id: true, name: true, tmId: true, country: true, isOpponentOnly: true }, orderBy: { name: "asc" } }),
  ])
  const entity = lineup ?? team
  if (!entity) notFound()
  const ids = lineup ? relatedLineupIds(lineup.id, lineups) : lineups.filter(l => l.teamId === team!.id).map(l => l.id)
  // With summaries, so a match taken over from a screenshot is not mistaken for a planned one
  const matches = await db.match.findMany({
    where: { opponentLineupId: { in: ids } },
    include: { ...opponentMatchInclude, subMatches: { ...opponentMatchInclude.subMatches, include: { ...opponentMatchInclude.subMatches.include, ...summaryInclude } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  }).then(shapeSummaries)
  const canEdit = !!session && await mayMaintainOpponent(session.user, lineup?.tournamentId)
  const role = (session?.user as { role?: string })?.role
  return <OpponentProfile kind={lineup ? "lineup" : "team"} entity={entity as unknown as TeamData | LineupData} choices={{ teams, lineups, tournaments, players } as unknown as OpponentChoices} matches={matches as HistoryMatch[]} relatedIds={ids} canEdit={canEdit} canAssign={canManage(role)} isAdmin={role === "ADMIN"} />
}
