import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { Format } from "@prisma/client"
import { canManage } from "@/lib/roles"
import { isValidDay } from "@/lib/player-status"
import { planStageChanges, sortStages, stageName } from "@/lib/stages"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const tournament = await db.tournament.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { subMatches: true } },
        },
      },
    },
  })

  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(tournament)
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  formats: z.array(z.nativeEnum(Format)).min(1).optional(),
  description: z.string().nullable().optional(),
  // The start date can be changed but not removed
  startDate: z.string().refine(isValidDay, "A valid start date is required").optional(),
  endDate: z.string().nullable().optional(),
  // Stages are added and removed at the end of their kind
  stages: z
    .object({
      seeding: z.boolean(),
      matchDays: z.number().int().min(1).max(20),
      playoffDays: z.number().int().min(0).max(10),
    })
    .optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, formats, description, startDate, endDate, stages } = parsed.data

  const existing = await db.stage.findMany({ where: { tournamentId: id }, include: { _count: { select: { matches: true } } } })
  const changes = stages
    ? planStageChanges(existing.map((s) => ({ ...s, matchCount: s._count.matches })), stages)
    : { create: [], remove: [], blocked: [] }
  // A stage with matches is never removed; nothing is changed until they are moved or deleted
  if (changes.blocked.length > 0) {
    const names = sortStages(changes.blocked).map((s) => stageName(s, existing)).join(", ")
    return NextResponse.json({ error: `Noch Matches vorhanden in: ${names}` }, { status: 409 })
  }

  const [tournament] = await db.$transaction([
    db.tournament.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(formats !== undefined && { formats }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    }),
    db.stage.deleteMany({ where: { id: { in: changes.remove } } }),
    db.stage.createMany({ data: changes.create.map((s) => ({ ...s, tournamentId: id })) }),
  ])
  const saved = await db.stage.findMany({ where: { tournamentId: id } })

  return NextResponse.json({ ...tournament, stages: saved })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await db.tournament.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
