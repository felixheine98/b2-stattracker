import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const lineups = await db.tournamentLineup.findMany({
    where: { tournamentId: id },
    orderBy: { createdAt: "asc" },
    include: { slots: { include: { player: true } } },
  })

  return NextResponse.json(lineups)
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  playerIds: z.array(z.string()).min(1, "Select at least one player"),
})

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const lineup = await db.tournamentLineup.create({
    data: {
      tournamentId: id,
      name: parsed.data.name,
      slots: {
        create: parsed.data.playerIds.map((playerId) => ({ playerId })),
      },
    },
    include: { slots: { include: { player: true } } },
  })

  return NextResponse.json(lineup, { status: 201 })
}
