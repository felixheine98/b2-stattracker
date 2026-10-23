import { NextResponse } from "next/server"
import { matchdayPlanningEnabled } from "./features"
import { mayEditLineup, sessionUser } from "./lineup-access-db"
import { findPlanLineup } from "./matchday-plan-db"

export interface PlanParams {
  params: Promise<{ id: string; lineupId: string; stageId: string }>
}

// Who may plan: the lineup's managers (until a week after the tournament) and admins and managers
export async function planAccess({ params }: PlanParams): Promise<{ ok: false; response: NextResponse } | { ok: true; lineup: NonNullable<Awaited<ReturnType<typeof findPlanLineup>>>; stageId: string }> {
  if (!matchdayPlanningEnabled()) return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  const user = await sessionUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const { id, lineupId, stageId } = await params
  const lineup = await findPlanLineup(id, lineupId, stageId)
  if (!lineup) return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  if (!mayEditLineup(user, lineup)) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { ok: true, lineup, stageId }
}
