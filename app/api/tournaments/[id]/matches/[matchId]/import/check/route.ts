import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkImport } from "@/lib/import-check"
import { loadImportContext } from "@/lib/import-check-db"
import { matchdayPlanningEnabled } from "@/lib/features"
import { planDeviations, type PlanDriver } from "@/lib/matchday-plan"
import type { Format } from "@/types"
import { publishedLineupOf } from "@/lib/matchday-plan-db"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"
import { NextResponse } from "next/server"
import { z } from "zod"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

const driver = z.object({ tmId: z.string().min(1).max(100), name: z.string().trim().min(1).max(100) })

// The sides an import dialog worked out, before anything is saved
const schema = z.object({
  ours: z.array(driver).max(100),
  foreign: z.array(driver).max(100),
  firstRoundTime: z.number().int().nonnegative().nullable().default(null),
  teams: z.object({ own: z.string().max(200), opponent: z.string().max(200) }).optional(),
  // Our drivers per sub-match, to compare with the finalised lineup of the match day
  driven: z.array(z.object({ format: z.enum(["ROUND_1V1", "ROUND_2V2", "ROUND_3V3", "ROUND_4V4", "ROUND_5V5", "TIME_ATTACK_10"]), drivers: z.array(driver).max(10) })).max(20).default([]),
})

// Compare an import with what is entered for the match: the hints for its preview and the
// day of its first round (see lib/import-check.ts), and where it was driven otherwise than
// planned (docs/adr/008), which needs no confirming. Saves nothing.
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, matchId } = await params
  const match = await db.match.findFirst({ where: { id: matchId, tournamentId: id }, select: { id: true, tournamentLineupId: true, stageId: true, subMatches: { select: { format: true } } } })
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  if (!(await mayEditLineupById(session.user as SessionUser, match.tournamentLineupId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid import data" }, { status: 400 })

  const context = await loadImportContext(matchId)
  const checked = context ? checkImport(parsed.data, context) : { hints: [], date: null }
  return NextResponse.json({ ...checked, planDeviations: await deviationsFromPlan(match, parsed.data.driven) })
}

async function deviationsFromPlan(match: { id: string; tournamentLineupId: string | null; stageId: string; subMatches: Array<{ format: Format }> }, driven: Array<{ format: Format; drivers: PlanDriver[] }>) {
  if (!matchdayPlanningEnabled() || driven.length === 0) return []
  const lineup = await publishedLineupOf({ ...match, formats: [...new Set(match.subMatches.map((sm) => sm.format))] })
  if (!lineup) return []
  const planned = Object.fromEntries(lineup.formats.map((f) => [f.format, f.players.filter((p) => p !== null)]))
  return planDeviations(planned, driven)
}
