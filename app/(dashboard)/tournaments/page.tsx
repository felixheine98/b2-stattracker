import { db } from "@/lib/db"
import { TournamentsView } from "./tournaments-view"

export default async function TournamentsPage() {
  const tournaments = await db.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { matches: true } } },
  })

  return <TournamentsView tournaments={tournaments} />
}
