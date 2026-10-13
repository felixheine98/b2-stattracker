import { db } from "./db"
import { importNoteLine, withImportNote, type ImportContext } from "./import-check"
import { dayKey } from "./player-status"
import type { Prisma, PrismaClient } from "@prisma/client"

const roster = { select: { player: { select: { tmId: true } } } } as const
const tmIds = (slots: Array<{ player: { tmId: string } }>) => slots.map((s) => s.player.tmId)

// What is entered for a match and its tournament, for checking an import against it (see
// lib/import-check.ts). Known for an opponent is who is in its roster or in the roster of its
// fixed team, and who drove for it in another match of the tournament; the rounds of this
// match do not count, since an import replaces them. null for a match without a lineup.
export async function loadImportContext(matchId: string, database: PrismaClient = db): Promise<ImportContext | null> {
  const match = await database.match.findUnique({
    where: { id: matchId },
    select: { tournamentId: true, date: true, tournamentLineupId: true, opponentLineupId: true },
  })
  if (!match?.tournamentLineupId) return null
  const { tournamentId } = match
  const [lineups, opponents, driven] = await Promise.all([
    database.tournamentLineup.findMany({ where: { tournamentId }, select: { id: true, name: true, slots: roster } }),
    database.opponentLineup.findMany({ where: { tournamentId }, select: { id: true, name: true, aliases: true, slots: roster, team: { select: { slots: roster } } } }),
    database.roundResult.findMany({
      where: { isOurTeam: false, round: { subMatch: { match: { tournamentId, opponentLineupId: { not: null }, id: { not: matchId } } } } },
      select: { tmId: true, round: { select: { subMatch: { select: { match: { select: { opponentLineupId: true } } } } } } },
    }),
  ])
  const own = lineups.map((l) => ({ id: l.id, name: l.name, tmIds: tmIds(l.slots) }))
  const lineup = own.find((l) => l.id === match.tournamentLineupId)
  if (!lineup) return null
  const known = opponents.map((o) => ({
    id: o.id,
    name: o.name,
    aliases: o.aliases,
    knownTmIds: [...new Set([
      ...tmIds(o.slots),
      ...tmIds(o.team?.slots ?? []),
      ...driven.filter((r) => r.round.subMatch.match.opponentLineupId === o.id).map((r) => r.tmId),
    ])],
  }))
  return {
    lineup,
    otherLineups: own.filter((l) => l.id !== lineup.id),
    opponent: known.find((o) => o.id === match.opponentLineupId) ?? null,
    otherOpponents: known.filter((o) => o.id !== match.opponentLineupId),
    matchDay: match.date ? dayKey(match.date) : null,
  }
}

// What an import leaves at the match besides its rounds: the line about the hints it was
// confirmed despite (dropped when there were none) and, if taken over, the day of the import.
export async function applyImportNote(tx: Prisma.TransactionClient, matchId: string, importer: string, warnings: string[], date?: string) {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, select: { notes: true } })
  const line = importNoteLine(dayKey(new Date()), importer, warnings.map((short) => ({ text: short, short })))
  await tx.match.update({ where: { id: matchId }, data: { notes: withImportNote(match.notes, line), ...(date && { date: new Date(date) }) } })
}
