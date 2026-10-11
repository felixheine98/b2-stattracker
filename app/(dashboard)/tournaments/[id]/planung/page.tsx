import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { tournamentPath } from "@/lib/paths"
import { buildPlanningState } from "@/lib/planning-db"
import { canManage } from "@/lib/roles"
import { resolveTournament } from "@/lib/slugs-db"
import { notFound, redirect } from "next/navigation"
import { PlanningView } from "./planning-view"

interface Props {
  params: Promise<{ id: string }>
}

// Planning of a tournament: who is available, and (for admins and managers) the lineup variants.
// The page keeps itself up to date while it is open, see lib/use-planning-live.ts.
export default async function PlanningPage({ params }: Props) {
  const { id: param } = await params
  const found = await resolveTournament(param)
  if (!found) notFound()
  if (param !== found.slug) redirect(`${tournamentPath(found)}/planung`)

  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  const mayManage = canManage(user?.role)
  const self = user?.id ? await db.user.findUnique({ where: { id: user.id }, select: { playerId: true } }) : null

  const state = await buildPlanningState(found.id, { userId: user?.id ?? "", canManage: mayManage, playerId: self?.playerId ?? null })
  // No planning started: the tournament page is where it begins
  if (!state) redirect(tournamentPath(found))

  return <PlanningView initial={state} ownPlayerId={self?.playerId ?? null} userId={user?.id ?? ""} canManage={mayManage} />
}
