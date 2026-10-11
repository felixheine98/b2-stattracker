import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string }>
}

// Start planning a tournament: from then on players are asked whether they take part
export async function POST(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const tournament = await db.tournament.findUnique({ where: { id }, select: { _count: { select: { tournamentLineups: true } } } })
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
  if (tournament._count.tournamentLineups > 0) {
    return NextResponse.json({ error: "This tournament already has lineups; planning comes before that." }, { status: 409 })
  }

  const planning = await db.planning.upsert({ where: { tournamentId: id }, create: { tournamentId: id }, update: {} })
  return NextResponse.json(planning, { status: 201 })
}
