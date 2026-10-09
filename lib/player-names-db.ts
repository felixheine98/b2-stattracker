import { db } from "@/lib/db"
import { applyCompNames, currentName } from "@/lib/player-names"
import { tournamentReferenceDate } from "@/lib/player-status"

// After the name history changed: bring Player.name in step with it and return the history
export async function syncPlayerName(playerId: string) {
  const player = await db.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { nameChanges: { orderBy: { effectiveFrom: "asc" } } },
  })
  const name = currentName(player)
  if (name !== player.name) await db.player.update({ where: { id: playerId }, data: { name } })
  return { name, initialName: player.initialName, nameChanges: player.nameChanges }
}

// Loaded data of a tournament with every player named as on the tournament's start day
export async function withCompNames<T>(data: T, tournament: { startDate?: Date | null; createdAt: Date }): Promise<T> {
  const players = await db.player.findMany({ select: { id: true, initialName: true, nameChanges: true } })
  return applyCompNames(data, players, tournamentReferenceDate(tournament))
}
