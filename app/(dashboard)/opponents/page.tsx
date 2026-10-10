import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { mayMaintainOpponent } from "@/lib/opponents-access-db"
import { OpponentsView } from "@/components/opponents/opponents-view"
import { rosterInclude } from "@/lib/opponents-db"
import type { OpponentChoices } from "@/components/opponents/types"
export default async function OpponentsPage() {
  const session = await auth()
  const [teams, lineups, tournaments] = await Promise.all([
    db.opponentTeam.findMany({ include: rosterInclude, orderBy: { name: "asc" } }),
    db.opponentLineup.findMany({ include: { ...rosterInclude, tournament: { select: { id: true, name: true } }, team: { select: { id: true, name: true, logo: true } }, _count: { select: { matches: true } } }, orderBy: { name: "asc" } }),
    db.tournament.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ])
  const canEdit = !!session && await mayMaintainOpponent(session.user)
  return <OpponentsView initial={{ teams, lineups, tournaments } as unknown as OpponentChoices} canEdit={canEdit} />
}
