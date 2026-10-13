import { db } from "@/lib/db"
import { answerOf, planningRows } from "@/lib/planning"
import { withCompNames } from "@/lib/player-names-db"
import type { VariantData } from "@/lib/planning-variants"
import { inTeam, selectable, statusAt, tournamentReferenceDate } from "@/lib/player-status"

// The planning of a tournament, and whether it can still be changed: once the tournament
// has lineups it is a read-only archive.
export async function loadPlanning(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      startDate: true,
      createdAt: true,
      _count: { select: { tournamentLineups: true } },
      planning: { include: { levels: { orderBy: { createdAt: "asc" } }, entries: true } },
    },
  })
  if (!tournament?.planning) return null
  return { tournament, planning: tournament.planning, archived: tournament._count.tournamentLineups > 0 }
}

// Plannings that are still open (their tournament has no lineups yet) in which the given player
// is asked for an answer: as a team member on the start day, or as a guest a manager added
export async function openPlanningsFor(playerId: string, tournamentId?: string) {
  const player = await db.player.findUnique({ where: { id: playerId }, include: { statusChanges: true } })
  if (!player) return []
  const plannings = await db.planning.findMany({
    where: { tournament: { tournamentLineups: { none: {} }, ...(tournamentId && { id: tournamentId }) } },
    orderBy: { createdAt: "desc" },
    include: {
      levels: { orderBy: { createdAt: "asc" } },
      entries: { where: { playerId } },
      tournament: { select: { id: true, slug: true, name: true, startDate: true, createdAt: true } },
    },
  })
  return plannings
    .filter((p) => p.entries.length > 0 || inTeam(statusAt(player, tournamentReferenceDate(p.tournament))))
    .map((p) => ({
      tournament: p.tournament,
      playerId,
      levels: p.levels.map((l) => ({ id: l.id, name: l.name })),
      answer: answerOf(p.entries[0], player.inactive),
      inactive: player.inactive,
      note: p.entries[0]?.note ?? null,
    }))
}

// The lineup variants of a planning, as the board shows them
export async function loadVariants(planningId: string): Promise<VariantData[]> {
  const variants = await db.planningVariant.findMany({
    where: { planningId },
    orderBy: { createdAt: "asc" },
    include: {
      lineups: { orderBy: { createdAt: "asc" } },
      slots: { orderBy: { createdAt: "asc" } },
      votes: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  return variants.map((v) => ({
    id: v.id,
    name: v.name,
    note: v.note,
    lineups: v.lineups.map((l) => ({ id: l.id, name: l.name, note: l.note, playerIds: v.slots.filter((s) => s.lineupId === l.id).map((s) => s.playerId) })),
    playerNotes: Object.fromEntries(v.slots.flatMap((s) => (s.note ? [[s.playerId, s.note]] : []))),
    votes: v.votes.map((vote) => ({ userId: vote.user.id, name: vote.user.name })),
  }))
}

// Call after every change to a planning, so the pages that have it open fetch the news
export async function bumpPlanning(planningId: string): Promise<number> {
  const { revision } = await db.planning.update({ where: { id: planningId }, data: { revision: { increment: 1 } }, select: { revision: true } })
  return revision
}

export interface PlanningViewer {
  userId: string
  canManage: boolean
  // The player linked to the viewer's account
  playerId: string | null
}

// Everything the planning page shows, cut down to what this viewer may see: notes of others and
// the lineup variants are for admins and managers only.
export async function buildPlanningState(tournamentId: string, viewer: PlanningViewer) {
  const [tournament, players] = await Promise.all([
    db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        slug: true,
        name: true,
        startDate: true,
        createdAt: true,
        _count: { select: { tournamentLineups: true } },
        planning: { include: { levels: { orderBy: { createdAt: "asc" } }, entries: true } },
      },
    }),
    db.player.findMany({ where: { isOpponentOnly: false }, select: { id: true, tmId: true, name: true, country: true, inactive: true, initialStatus: true, statusChanges: true } }),
  ])
  if (!tournament?.planning) return null

  const named = await withCompNames(players, tournament)
  const rows = planningRows(named, tournament.planning.entries, tournamentReferenceDate(tournament)).map((row) => ({
    player: { id: row.player.id, tmId: row.player.tmId, name: row.player.name, country: row.player.country },
    answer: row.answer,
    // Without an own answer the player counts as inactive, not as open
    inactive: row.player.inactive,
    guest: row.guest,
    // Notes are private: only admins and managers read those of others. undefined hides the field.
    note: viewer.canManage || row.player.id === viewer.playerId ? row.entry?.note ?? null : undefined,
  }))
  const onList = new Set(rows.map((r) => r.player.id))

  return {
    tournament: { id: tournament.id, slug: tournament.slug, name: tournament.name },
    revision: tournament.planning.revision,
    // Once the tournament has lineups nothing can be changed any more
    archived: tournament._count.tournamentLineups > 0,
    // The variant the lineups were taken from; only meaningful while the tournament has them
    adoptedVariantId: tournament._count.tournamentLineups > 0 ? tournament.planning.adoptedVariantId : null,
    levels: tournament.planning.levels.map((l) => ({ id: l.id, name: l.name })),
    rows,
    // Guests a manager can still add to the list
    addable: viewer.canManage ? named.filter((p) => !onList.has(p.id) && selectable(p)).map((p) => ({ id: p.id, tmId: p.tmId, name: p.name })) : [],
    variants: viewer.canManage ? await loadVariants(tournament.planning.id) : null,
  }
}

export type PlanningState = NonNullable<Awaited<ReturnType<typeof buildPlanningState>>>
