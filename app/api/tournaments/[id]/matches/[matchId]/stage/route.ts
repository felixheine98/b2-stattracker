import { syncTournamentSlugs } from "@/lib/slugs-db"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

const schema = z.object({ stageId: z.string().min(1) })

// Move a match to another stage of its tournament. Seeding matches have different
// sub-matches, so a match never moves into or out of the seeding.
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, matchId } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const [match, target] = await Promise.all([
    db.match.findUnique({ where: { id: matchId }, include: { stage: true } }),
    db.stage.findUnique({ where: { id: parsed.data.stageId } }),
  ])
  if (!match || match.tournamentId !== id) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  if (!target || target.tournamentId !== id) return NextResponse.json({ error: "Stage not found" }, { status: 400 })
  if (match.stage.type === "SEEDING" || target.type === "SEEDING") {
    return NextResponse.json({ error: "Seeding-Matches lassen sich nicht verschieben" }, { status: 400 })
  }

  await db.match.update({ where: { id: matchId }, data: { stageId: target.id } })
  // The stage is part of the match's address
  await syncTournamentSlugs(id)
  const { slug } = await db.match.findUniqueOrThrow({ where: { id: matchId }, select: { slug: true } })
  return NextResponse.json({ stageId: target.id, slug })
}
