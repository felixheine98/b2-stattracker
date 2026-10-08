import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { Format } from "@prisma/client"
import { canManage } from "@/lib/roles"
import { isValidDay } from "@/lib/player-status"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tournaments = await db.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { matches: true } } },
  })

  return NextResponse.json(tournaments)
}

const createSchema = z.object({
  name: z.string().min(1),
  formats: z.array(z.nativeEnum(Format)).min(1, "Select at least one format"),
  description: z.string().nullable().optional(),
  // Required: the start day decides who counts as member or guest in this tournament
  startDate: z.string().refine(isValidDay, "A valid start date is required"),
  endDate: z.string().nullable().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const tournament = await db.tournament.create({
    data: {
      name: parsed.data.name,
      formats: parsed.data.formats,
      description: parsed.data.description ?? null,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    },
  })

  return NextResponse.json(tournament, { status: 201 })
}
