import { db } from "@/lib/db"

// A player may only be part of one lineup per tournament.
// Returns an error message if one of the players already belongs to another lineup.
export async function findLineupConflict(
  tournamentId: string,
  playerIds: string[],
  excludeLineupId?: string
): Promise<string | null> {
  const taken = await db.tournamentLineupSlot.findMany({
    where: {
      playerId: { in: playerIds },
      lineup: { tournamentId, ...(excludeLineupId && { id: { not: excludeLineupId } }) },
    },
    include: { player: { select: { name: true } }, lineup: { select: { name: true } } },
  })
  if (taken.length === 0) return null
  return `Already in another lineup: ${taken.map((s) => `${s.player.name} (${s.lineup.name})`).join(", ")}`
}
