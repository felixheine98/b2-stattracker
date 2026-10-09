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
  if (!canManage((session?.user as { role?: string })?.role)) redirect("/dashboard")

  await ensureSlugs()
  const tournaments = await db.tournament.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      startDate: true,
      createdAt: true,
      stages: { select: { id: true, type: true, number: true } },
      tournamentLineups: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          matches: { orderBy: { createdAt: "asc" }, select: { id: true, slug: true, opponent: true, stageId: true } },
        },
      },
    },
  })

  return <EcmImportView tournaments={tournaments} />
}
