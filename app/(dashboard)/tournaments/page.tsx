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
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { matches: true } } },
    }),
  ])

  return <TournamentsView tournaments={tournaments} canManage={canManage((session?.user as { role?: string })?.role)} />
}
