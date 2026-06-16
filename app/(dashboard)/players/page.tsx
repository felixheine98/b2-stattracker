import { db } from "@/lib/db"
import { PlayersView } from "./players-view"

export default async function PlayersPage() {
  const players = await db.player.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { roundResults: true } },
    },
    orderBy: { name: "asc" },
  })

  return <PlayersView players={players} />
}
