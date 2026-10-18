import { ensureSlugs } from "@/lib/slugs-db"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { parseStyle } from "@/lib/comp-styles"
import { matchRulesEnabled } from "@/lib/features"
import { TournamentsView } from "./tournaments-view"

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ style?: string | string[] }> }) {
  await ensureSlugs()
  const [session, { style }, tournaments] = await Promise.all([
    auth(),
    searchParams,
    db.tournament.findMany({
      // The latest tournament first, by the day it starts
      orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      include: { _count: { select: { matches: true } }, tfhRace: { select: { kind: true, _count: { select: { teams: true } } } } },
    }),
  ])

  const role = (session?.user as { role?: string })?.role
  return <TournamentsView tournaments={tournaments} style={parseStyle(style)} canManage={canManage(role)} isAdmin={role === "ADMIN"} matchRules={matchRulesEnabled()} />
}
