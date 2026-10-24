// Loading the seeding stats of a comp or one of its lineups (docs/adr/010); the sums are in lib/seeding-stats.ts
import { db } from "./db"
import { lineupPath, matchPath, playerPath } from "./paths"
import { mapLabel, seedingSettings } from "./seeding"
import { seedingStats } from "./seeding-stats"

// Null for a comp without a seeding format or while nothing of its seeding is recorded
export async function loadSeedingStats(tournamentId: string, lineupId?: string) {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, slug: true, seedingType: true, seedingSettings: true } })
  const settings = tournament && seedingSettings(tournament.seedingType, tournament.seedingSettings)
  if (!settings) return null
  const matches = await db.match.findMany({
    where: { tournamentId, stage: { type: "SEEDING" }, tournamentLineupId: lineupId ?? { not: null } },
    select: {
      id: true, slug: true, seedingPlace: true, seedingLeague: true, stage: { select: { seedingMaps: true } },
      tournamentLineup: { select: { id: true, slug: true, name: true } },
      subMatches: { orderBy: { order: "asc" }, select: { seedingRun: { select: { score: true, player: { select: { id: true, slug: true, name: true, nickname: true, country: true, tmId: true } } } } } },
    },
  })
  const recorded = matches.filter((m) => m.seedingPlace != null || m.seedingLeague || m.subMatches.some((sm) => sm.seedingRun?.score != null))
  if (recorded.length === 0) return null

  const stats = seedingStats(settings, recorded.map((m) => ({
    lineupId: m.tournamentLineup!.id,
    place: m.seedingPlace,
    league: m.seedingLeague,
    runs: m.subMatches.flatMap((sm) => (sm.seedingRun ? [{ playerId: sm.seedingRun.player?.id ?? null, score: sm.seedingRun.score }] : [])),
  })))
  const players = new Map(recorded.flatMap((m) => m.subMatches.flatMap((sm) => (sm.seedingRun?.player ? [[sm.seedingRun.player.id, sm.seedingRun.player] as const] : []))))
  return {
    best: settings.best,
    maps: Array.from({ length: settings.maps }, (_, map) => mapLabel(map, recorded[0].stage.seedingMaps)),
    lineups: stats.lineups.map((row) => {
      const match = recorded.find((m) => m.tournamentLineup!.id === row.lineupId)!
      return { ...row, name: match.tournamentLineup!.name, lineupHref: lineupPath(tournament, match.tournamentLineup!), matchHref: matchPath(tournament, match.tournamentLineup!, match) }
    }),
    players: stats.players.map((row) => {
      const player = players.get(row.playerId)!
      const lineup = recorded.find((m) => m.tournamentLineup!.id === row.lineupId)!.tournamentLineup!
      return { ...row, lineupName: lineup.name, player: { id: player.id, name: player.name, nickname: player.nickname, country: player.country, tmId: player.tmId }, href: playerPath(player) }
    }),
  }
}

export type LoadedSeedingStats = NonNullable<Awaited<ReturnType<typeof loadSeedingStats>>>
