import { ensureSlugs } from "@/lib/slugs-db"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { TournamentsView } from "./tournaments-view"

export default async function TournamentsPage() {
  await ensureSlugs()
  const [session, tournaments] = await Promise.all([
    auth(),
    db.tournament.findMany({
      // The latest tournament first, by the day it starts
      orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      include: { _count: { select: { matches: true } }, tfhRace: { select: { kind: true, _count: { select: { teams: true } } } } },
    }),
  ])

  const role = (session?.user as { role?: string })?.role
  return <TournamentsView tournaments={tournaments} canManage={canManage(role)} isAdmin={role === "ADMIN"} />
}
