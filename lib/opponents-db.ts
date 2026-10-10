import type { Prisma } from "@prisma/client"
import { db } from "./db"
import { confirmedTmId, opponentNameKey, resolveOpponentName } from "./opponents"

export class OpponentError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}
export const rosterInclude = { slots: { include: { player: true } } } as const
export const opponentMatchInclude = {
  tournament: { select: { id: true, name: true, slug: true } },
  tournamentLineup: { select: { id: true, name: true, slug: true } },
  stage: { select: { type: true } },
  subMatches: { orderBy: { order: "asc" as const }, include: { rounds: { include: { results: { orderBy: [{ position: "asc" as const }, { timeMs: "asc" as const }] } } } } },
} satisfies Prisma.MatchInclude

export interface OpponentSelection { lineupId?: string | null; teamId?: string | null; name?: string | null }
export async function resolveMatchOpponent(tx: Prisma.TransactionClient, tournamentId: string, selection: OpponentSelection) {
  if (selection.lineupId) {
    const lineup = await tx.opponentLineup.findUnique({ where: { id: selection.lineupId } })
    if (!lineup || lineup.tournamentId !== tournamentId) throw new OpponentError("Das Gegner-Lineup gehört nicht zu dieser Competition.")
    return lineup
  }
  if (selection.teamId) {
    const team = await tx.opponentTeam.findUnique({ where: { id: selection.teamId }, include: rosterInclude })
    if (!team) throw new OpponentError("Team nicht gefunden.", 404)
    const existing = await tx.opponentLineup.findMany({ where: { tournamentId, teamId: team.id, archived: false } })
    if (existing.length === 1) return existing[0]
    if (existing.length > 1) throw new OpponentError("Dieses Team hat mehrere Lineups. Bitte ein konkretes Lineup wählen.")
    return tx.opponentLineup.create({ data: { tournamentId, teamId: team.id, name: team.name, nameKey: opponentNameKey(team.name), slots: { create: team.slots.map(s => ({ playerId: s.playerId })) } } })
  }
  const name = selection.name?.trim()
  if (!name) return null
  const entries = await tx.opponentLineup.findMany({ where: { tournamentId } })
  const id = resolveOpponentName(name, entries)
  if (id) return entries.find(e => e.id === id)!
  if (entries.some(e => [e.name, ...e.aliases].some(n => opponentNameKey(n) === opponentNameKey(name)))) throw new OpponentError("Der Gegnername ist mehrdeutig. Bitte ein konkretes Lineup wählen.")
  return tx.opponentLineup.create({ data: { tournamentId, name, nameKey: opponentNameKey(name) } })
}

export async function resolveOpponentPlayer(tx: Prisma.TransactionClient, lineupId: string | null, sourceId: string, name: string, appearance?: { subMatchId: string; number: number }) {
  if (sourceId.startsWith("opponent-")) return null
  if (sourceId.startsWith("unknown-")) return tx.player.findUnique({ where: { tmId: sourceId } })
  if (lineupId && appearance) {
    const selected = await tx.opponentIdentity.findUnique({ where: { lineupId_sourceId: { lineupId, sourceId: `appearance:${appearance.subMatchId}:${appearance.number}:${sourceId}` } }, include: { player: true } })
    if (selected) return selected.player
  }
  const realId = confirmedTmId(sourceId)
  if (realId) return tx.player.upsert({ where: { tmId: realId }, update: {}, create: { tmId: realId, name, initialName: name, isOpponentOnly: true } })
  if (!lineupId) return null
  const existing = await tx.opponentIdentity.findUnique({ where: { lineupId_sourceId: { lineupId, sourceId } }, include: { player: true } })
  if (existing) return existing.player
  const person = await tx.player.create({ data: { tmId: `unknown-${crypto.randomUUID()}`, name, initialName: name, isOpponentOnly: true } })
  await tx.opponentIdentity.create({ data: { lineupId, sourceId, playerId: person.id } })
  return person
}

export function assignmentConflicts(selected: Array<{ id: string; roundId: string }>, occupied: Array<{ id: string; roundId: string }>) {
  const ids = new Set(selected.map(r => r.id)), rounds = new Set(selected.map(r => r.roundId))
  return rounds.size !== selected.length || occupied.some(r => rounds.has(r.roundId) && !ids.has(r.id))
}

// Called in the same transaction as an actual result mutation. The match update locks
// its row and advances the revision used by confirmation's optimistic check.
export async function reopenMatch(tx: Prisma.TransactionClient, matchId: string) {
  await tx.match.update({ where: { id: matchId }, data: { closedAt: null, confirmedOutcome: null, resultRevision: { increment: 1 } } })
}

export async function assignOpponentIdentities(input: { tmId: string; resultIds: string[]; rosterPlayerIds: string[] }, client: typeof db = db) {
  return client.$transaction(async tx => {
    const selected = await tx.roundResult.findMany({ where: { id: { in: input.resultIds }, isOurTeam: false }, include: { round: { include: { subMatch: { include: { match: true } } } } } })
    if (selected.length !== new Set(input.resultIds).size) throw new OpponentError("Ein ausgewählter Auftritt ist nicht mehr verfügbar.", 409)
    const occupied = await tx.roundResult.findMany({ where: { roundId: { in: selected.map(r => r.roundId) }, tmId: input.tmId } })
    if (assignmentConflicts(selected, occupied)) throw new OpponentError("In einer Runde ist dieser Account bereits belegt. Bitte die Auswahl korrigieren.", 409)
    const target = await tx.player.findUniqueOrThrow({ where: { tmId: input.tmId } })
    for (const r of selected) {
      await tx.roundResult.update({ where: { id: r.id }, data: { tmId: target.tmId, playerId: target.id } })
      const lineupId = r.round.subMatch.match.opponentLineupId
      if (lineupId) {
        // Persist exactly the selected appearances, not every equal name in this lineup.
        for (const rawId of new Set([r.tmId, `ecm-${r.playerName}`])) {
          const sourceId = `appearance:${r.round.subMatchId}:${r.round.number}:${rawId}`
          await tx.opponentIdentity.upsert({ where: { lineupId_sourceId: { lineupId, sourceId } }, create: { lineupId, sourceId, playerId: target.id }, update: { playerId: target.id } })
        }
      }
    }
    const rosterPlayers = await tx.player.findMany({ where: { id: { in: input.rosterPlayerIds }, isOpponentOnly: true } })
    if (rosterPlayers.length !== new Set(input.rosterPlayerIds).size) throw new OpponentError("Ungültige Kaderauswahl.")
    await tx.player.update({ where: { id: target.id }, data: { opponentNames: [...new Set([...target.opponentNames, ...selected.map(r => opponentNameKey(r.playerName)), ...rosterPlayers.flatMap(p => [opponentNameKey(p.name), ...p.opponentNames])])] } })
    for (const source of rosterPlayers) {
      if (source.id === target.id) continue
      const teams = await tx.opponentTeamSlot.findMany({ where: { playerId: source.id } })
      const lineups = await tx.opponentLineupSlot.findMany({ where: { playerId: source.id } })
      for (const slot of teams) {
        await tx.opponentTeamSlot.upsert({ where: { teamId_playerId: { teamId: slot.teamId, playerId: target.id } }, create: { teamId: slot.teamId, playerId: target.id }, update: {} })
        await tx.opponentTeamSlot.delete({ where: { id: slot.id } })
      }
      for (const slot of lineups) {
        await tx.opponentLineupSlot.upsert({ where: { lineupId_playerId: { lineupId: slot.lineupId, playerId: target.id } }, create: { lineupId: slot.lineupId, playerId: target.id }, update: {} })
        await tx.opponentLineupSlot.delete({ where: { id: slot.id } })
      }
    }
    return target
  })
}

export async function createRosterPlayer(tx: Prisma.TransactionClient, name: string, country?: string | null) {
  return tx.player.create({ data: { tmId: `unknown-${crypto.randomUUID()}`, name, initialName: name, country: country ?? null, isOpponentOnly: true } })
}
