import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { Format } from "@prisma/client"
import { canManage } from "@/lib/roles"
import { isValidDay } from "@/lib/player-status"

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

  const { name, formats, description, startDate, endDate } = parsed.data
  const tournament = await db.tournament.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(formats !== undefined && { formats }),
      ...(description !== undefined && { description }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    },
  })

  return NextResponse.json(tournament)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await db.tournament.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
