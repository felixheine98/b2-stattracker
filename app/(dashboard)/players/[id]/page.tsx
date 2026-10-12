import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { lineupPath, matchPath, playerPath, tournamentPath } from "@/lib/paths"
import { buildProfile } from "@/lib/player-profile"
import { dayKey, statusAt, tournamentReferenceDate } from "@/lib/player-status"
import { canManage } from "@/lib/roles"
import { resolvePlayer } from "@/lib/slugs-db"
import { sortStages, stageName } from "@/lib/stages"
import { notFound, redirect } from "next/navigation"
import { PlayerProfileView, type CompView } from "./player-profile-view"
import { getTfhPlayerResults } from "@/lib/tfh-db"
import { TfhPlayerSection } from "@/components/tfh/player-section"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PlayerProfilePage({ params }: Props) {
  // The address holds the player's slug; an ID or a former slug is redirected to it
  const { id: param } = await params
  const found = await resolvePlayer(param)
  if (!found) notFound()
  if (param !== found.slug) redirect(playerPath(found))
  const id = found.id

  const [session, player, tournaments, matches, opponentResults, tfhResults] = await Promise.all([
    auth(),
    db.player.findUnique({
      where: { id },
      include: {
        statusChanges: { orderBy: { effectiveFrom: "asc" } },
        nameChanges: { orderBy: { effectiveFrom: "asc" } },
        user: { select: { username: true } },
        // Tournaments the player took part in, for the status history
        tournamentLineupSlots: {
          select: { lineup: { select: { name: true, tournament: { select: { id: true, name: true, startDate: true, createdAt: true } } } } },
        },
      },
    }),
    db.tournament.findMany({
      where: { tfhRace: { is: null } },
      select: {
        id: true, slug: true, name: true, startDate: true, createdAt: true,
        stages: { select: { id: true, type: true, number: true } },
        tournamentLineups: { select: { id: true, slug: true, name: true, slots: { select: { playerId: true } } } },
      },
    }),
    // Everyone's rounds, not only this player's: pace and bests are ranked within the team
    db.match.findMany({
      where: { tournamentLineupId: { not: null } },
      select: {
        id: true, slug: true, date: true, opponent: true, tournamentId: true, tournamentLineupId: true,
        stage: { select: { id: true, type: true, number: true } },
        subMatches: {
          orderBy: { order: "asc" },
          select: {
            format: true,
            rounds: {
              orderBy: { number: "asc" },
              select: {
                track: true,
                results: {
                  orderBy: [{ position: "asc" }, { timeMs: "asc" }],
                  select: { playerId: true, isOurTeam: true, dnf: true, timeMs: true },
                },
              },
            },
          },
        },
      },
    }),
    db.roundResult.count({ where: { playerId: id, isOurTeam: false } }),
    getTfhPlayerResults(id),
  ])
  if (!player) notFound()

  // Newest tournament first
  const ordered = [...tournaments].sort((a, b) => dayKey(tournamentReferenceDate(b)).localeCompare(dayKey(tournamentReferenceDate(a))))
  const profile = buildProfile(
    id,
    ordered.map((t) => ({ id: t.id, lineups: t.tournamentLineups.map((l) => ({ id: l.id, playerIds: l.slots.map((s) => s.playerId) })) })),
    matches
  )

  const matchById = new Map(matches.map((m) => [m.id, m]))
  const comps: CompView[] = profile.comps.map((comp) => {
    const tournament = ordered.find((t) => t.id === comp.tournamentId)!
    const day = tournamentReferenceDate(tournament)
    const lineup = (lineupId: string | null) => tournament.tournamentLineups.find((l) => l.id === lineupId)
    const stages = sortStages(tournament.stages)
    const matchLink = (matchId: string | null) => {
      const match = matchId ? matchById.get(matchId) : undefined
      const of = match && lineup(match.tournamentLineupId)
      return match && of ? { match, lineup: of, path: matchPath(tournament, of, match) } : null
    }
    return {
      ...comp,
      name: tournament.name,
      path: tournamentPath(tournament),
      day: tournament.startDate ? dayKey(tournament.startDate) : null,
      status: statusAt(player, day),
      lineups: comp.lineupIds.flatMap((lineupId) => {
        const l = lineup(lineupId)
        return l ? [{ id: l.id, name: l.name, path: lineupPath(tournament, l) }] : []
      }),
      maps: comp.maps.map((map) => ({ ...map, pbMatchPath: matchLink(map.pbMatchId)?.path ?? null })),
      matches: comp.matches
        .flatMap((line) => {
          const link = matchLink(line.matchId)
          if (!link) return []
          const { match } = link
          return [{
            ...line,
            path: link.path,
            day: match.date ? dayKey(match.date) : null,
            stage: stageName(match.stage, stages),
            stageIndex: stages.findIndex((s) => s.id === match.stage.id),
            opponent: match.opponent,
            lineupName: link.lineup.name,
          }]
        })
        // In playing order
        .sort((a, b) => a.stageIndex - b.stageIndex || (a.day ?? "").localeCompare(b.day ?? "")),
    }
  })

  return (
    <PlayerProfileView
      player={player}
      total={profile.total}
      formats={profile.formats}
      comps={comps}
      hasOpponentProfile={opponentResults > 0}
      canManage={canManage((session?.user as { role?: string })?.role)}
      endurance={<TfhPlayerSection results={tfhResults} />}
      hasEndurance={tfhResults.length > 0}
    />
  )
}
