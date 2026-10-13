import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { applyImportNote } from "@/lib/import-check-db"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"
import { NextResponse } from "next/server"
import { z } from "zod"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

// The hints an import was confirmed despite, in their short form
const schema = z.object({ warnings: z.array(z.string().trim().min(1).max(200)).max(50) })

// Leave the line about an import despite hints in the notes of the match, or take the line
// of the import before away. For imports that save their rounds sub-match by sub-match (eCM);
// the CSV import does this along with its rounds.
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, matchId } = await params
  const match = await db.match.findFirst({ where: { id: matchId, tournamentId: id }, select: { tournamentLineupId: true } })
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  if (!(await mayEditLineupById(session.user as SessionUser, match.tournamentLineupId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid import data" }, { status: 400 })

  await db.$transaction((tx) => applyImportNote(tx, matchId, session.user?.name ?? "unknown", parsed.data.warnings))
  return NextResponse.json({ ok: true })
}
