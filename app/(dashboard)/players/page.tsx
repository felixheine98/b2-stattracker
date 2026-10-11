import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { PlayersView } from "./players-view"

export default async function PlayersPage() {
  const [session, players, users, played] = await Promise.all([
    auth(),
    db.player.findMany({ where: { isOpponentOnly: false },
      include: {
        user: { select: { id: true, name: true, email: true, username: true, role: true } },
        statusChanges: { orderBy: { effectiveFrom: "asc" } },
        nameChanges: { orderBy: { effectiveFrom: "asc" } },
        // Tournaments the player took part in, for the status history
        tournamentLineupSlots: {
          select: {
            lineup: {
              select: {
                name: true,
                tournament: { select: { id: true, name: true, startDate: true, createdAt: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      select: { id: true, name: true, username: true, playerId: true },
      orderBy: { name: "asc" },
    }),
    // Tournaments each player drove at least one round for us in
    db.$queryRaw<Array<{ playerId: string; tournaments: bigint }>>`
      SELECT rr."playerId", COUNT(DISTINCT m."tournamentId") AS tournaments
      FROM "RoundResult" rr
      JOIN "Round" r ON r.id = rr."roundId"
      JOIN "SubMatch" s ON s.id = r."subMatchId"
      JOIN "Match" m ON m.id = s."matchId"
      WHERE rr."isOurTeam" AND rr."playerId" IS NOT NULL
      GROUP BY rr."playerId"`,
  ])
  const tournamentsPlayed = new Map(played.map((row) => [row.playerId, Number(row.tournaments)]))

  const role = (session?.user as { role?: string })?.role
  return <PlayersView players={players.map((p) => ({ ...p, tournamentsPlayed: tournamentsPlayed.get(p.id) ?? 0 }))} users={users} canManage={canManage(role)} />
}
