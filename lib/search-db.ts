import { db } from "@/lib/db"
import { confirmedTmId, opponentNameKey } from "@/lib/opponents"
import { matchPath, playerPath, tournamentPath } from "@/lib/paths"
import { allNames } from "@/lib/player-names"
import { currentStatus, dayKey, formatDay, tournamentReferenceDate } from "@/lib/player-status"
import type { SearchEntry } from "@/lib/search"
import { stageName } from "@/lib/stages"

// Everything the search can find, with the address of its page
export async function searchIndex(): Promise<SearchEntry[]> {
  const [players, teams, lineups, tournaments, matches] = await Promise.all([
    db.player.findMany({ include: { nameChanges: true, statusChanges: true }, orderBy: { name: "asc" } }),
    db.opponentTeam.findMany({ select: { id: true, name: true, aliases: true, archived: true } }),
    db.opponentLineup.findMany({
      select: { id: true, name: true, aliases: true, archived: true, tournament: { select: { name: true } }, team: { select: { name: true } } },
    }),
    db.tournament.findMany({ select: { id: true, slug: true, name: true, startDate: true, createdAt: true, stages: { select: { type: true, number: true } } } }),
    db.match.findMany({
      where: { tournamentLineupId: { not: null } },
      select: {
        id: true, slug: true, date: true, opponent: true, tournamentId: true,
        stage: { select: { type: true, number: true } },
        tournamentLineup: { select: { id: true, slug: true, name: true } },
        opponentLineup: { select: { name: true, aliases: true, team: { select: { name: true, aliases: true } } } },
      },
    }),
  ])
  const tournamentById = new Map(tournaments.map((t) => [t.id, t]))
  const marker = (archived: boolean) => (archived ? ({ marker: "archiviert" } as const) : {})

  return [
    ...players.map((p): SearchEntry =>
      p.isOpponentOnly
        ? {
            kind: "opponentPlayer",
            id: p.id,
            title: p.name,
            href: `/opponents/players/${p.id}`,
            // Names the person appeared under in results, as far as they differ
            aliases: [...new Set([p.initialName, ...p.opponentNames])].filter((n) => opponentNameKey(n) !== opponentNameKey(p.name)),
            ...(!confirmedTmId(p.tmId) && { marker: "unbestätigt" as const }),
          }
        : {
            kind: "player",
            id: p.id,
            title: p.name,
            ...(currentStatus(p) === "TRIAL" && { detail: "Trial" }),
            ...(currentStatus(p) === "GUEST" && { detail: "Gast" }),
            ...(currentStatus(p) === "FORMER" && { marker: "ehemalig" as const }),
            href: playerPath(p),
            aliases: allNames(p).filter((n) => n !== p.name),
          }
    ),
    ...teams.map((t): SearchEntry => ({ kind: "team", id: t.id, title: t.name, href: `/opponents/${t.id}?kind=team`, aliases: t.aliases, ...marker(t.archived) })),
    ...lineups.map((l): SearchEntry => ({
      kind: "lineup",
      id: l.id,
      title: l.name,
      detail: [l.team && l.team.name !== l.name ? l.team.name : null, l.tournament.name].filter(Boolean).join(" · "),
      href: `/opponents/${l.id}`,
      aliases: l.aliases,
      ...marker(l.archived),
    })),
    ...tournaments.map((t): SearchEntry => ({
      kind: "tournament",
      id: t.id,
      title: t.name,
      ...(t.startDate && { detail: formatDay(t.startDate) }),
      href: tournamentPath(t),
      date: dayKey(tournamentReferenceDate(t)),
    })),
    ...matches.flatMap((m): SearchEntry[] => {
      const tournament = tournamentById.get(m.tournamentId)
      const lineup = m.tournamentLineup
      if (!tournament || !lineup) return []
      const seeding = m.stage.type === "SEEDING"
      const opponent = m.opponentLineup
      return [{
        kind: "match",
        id: m.id,
        title: seeding ? `${lineup.name} · Seeding` : `${lineup.name} vs ${m.opponent ?? "Unbekannt"}`,
        detail: [seeding ? null : stageName(m.stage, tournament.stages), m.date ? formatDay(m.date) : null, tournament.name].filter(Boolean).join(" · "),
        href: matchPath(tournament, lineup, m),
        terms: [
          m.opponent, opponent?.name, ...(opponent?.aliases ?? []), opponent?.team?.name, ...(opponent?.team?.aliases ?? []),
          lineup.name, tournament.name,
        ].filter((t): t is string => !!t),
        date: m.date ? dayKey(m.date) : null,
      }]
    }),
  ]
}
