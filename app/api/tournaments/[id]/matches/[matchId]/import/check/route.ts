import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkImport } from "@/lib/import-check"
import { loadImportContext } from "@/lib/import-check-db"
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
})

// Compare an import with what is entered for the match: the hints for its preview and the
// day of its first round (see lib/import-check.ts). Saves nothing.
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, matchId } = await params
  const match = await db.match.findFirst({ where: { id: matchId, tournamentId: id }, select: { tournamentLineupId: true } })
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  if (!(await mayEditLineupById(session.user as SessionUser, match.tournamentLineupId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid import data" }, { status: 400 })

  const context = await loadImportContext(matchId)
  return NextResponse.json(context ? checkImport(parsed.data, context) : { hints: [], date: null })
}
