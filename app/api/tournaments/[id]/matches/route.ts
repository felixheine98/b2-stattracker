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
  const matches = await db.match.findMany({
    where: { tournamentId: id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { subMatches: true } },
    },
  })

  return NextResponse.json(matches)
}

const createSchema = z.object({
  stageId: z.string().min(1),
  opponent: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lineupId: z.string().nullable().optional(),
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

  const stage = await db.stage.findUnique({ where: { id: parsed.data.stageId } })
  if (!stage || stage.tournamentId !== id) return NextResponse.json({ error: "Stage not found" }, { status: 400 })

  // Fetch lineup slots if a tournament lineup was selected
  let lineupPlayerIds: string[] = []
  if (parsed.data.lineupId) {
    const tl = await db.tournamentLineup.findUnique({
      where: { id: parsed.data.lineupId, tournamentId: id },
      include: { slots: { select: { playerId: true } } },
    })
    if (tl) lineupPlayerIds = tl.slots.map((s) => s.playerId)
  }

  const subMatchFormats = stage.type === "SEEDING"
    ? [{ format: "TIME_ATTACK_10" as const, order: 0 }]
    : tournament.formats
        .filter((f) => f !== "TIME_ATTACK_10")
        .map((f, i) => ({ format: f, order: i }))

  const lineupCreate = lineupPlayerIds.length > 0
    ? { create: { slots: { create: lineupPlayerIds.map((playerId) => ({ playerId })) } } }
    : undefined

  const match = await db.match.create({
    data: {
      tournamentId: id,
      stageId: stage.id,
      opponent: parsed.data.opponent ?? null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      notes: parsed.data.notes ?? null,
      tournamentLineupId: parsed.data.lineupId ?? null,
      subMatches: {
        create: subMatchFormats.map((sm) => ({ ...sm, lineup: lineupCreate })),
      },
    },
    include: { _count: { select: { subMatches: true } }, stage: { select: { id: true, type: true } }, subMatches: { include: { rounds: { include: { results: true } } } } },
  })

  return NextResponse.json(match, { status: 201 })
}
