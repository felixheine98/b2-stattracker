import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const matches = await db.match.findMany({
    where: { tournamentId: id },
    orderBy: { date: "desc" },
    include: {
      lineup: { include: { slots: { include: { player: true } } } },
      _count: { select: { rounds: true } },
    },
  })

  return NextResponse.json(matches)
}

const createSchema = z.object({
  opponent: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const match = await db.match.create({
    data: {
      tournamentId: id,
      opponent: parsed.data.opponent ?? null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      notes: parsed.data.notes ?? null,
    },
  })

  return NextResponse.json(match, { status: 201 })
}
