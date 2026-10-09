import { mayEditLineup, type SessionUser } from "@/lib/lineup-access-db"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { ensureSlugs } from "@/lib/slugs-db"
import { redirect } from "next/navigation"
import { EcmImportView } from "./ecm-import-view"

// Where the eCM bookmarklet lands: it brings the match data along in the address,
// and this page finds (or creates) the match it belongs to.
export default async function EcmImportPage() {
  const session = await auth()
  const user = (session?.user as SessionUser | undefined) ?? null

  await ensureSlugs()
  const all = await db.tournament.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      stages: { select: { id: true, type: true, number: true } },
      tournamentLineups: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          managers: { select: { userId: true } },
          matches: { orderBy: { createdAt: "asc" }, select: { id: true, slug: true, opponent: true, stageId: true } },
        },
      },
    },
  })

  // Only the lineups this user may maintain: all of them for admins and managers,
  // for others those they are responsible for
  const tournaments = all
    .map((t) => ({ ...t, tournamentLineups: t.tournamentLineups.filter((l) => mayEditLineup(user, { managers: l.managers, tournament: t })) }))
    .filter((t) => canManage(user?.role) || t.tournamentLineups.length > 0)
  if (!canManage(user?.role) && tournaments.length === 0) redirect("/dashboard")

  return <EcmImportView tournaments={tournaments} />
}
