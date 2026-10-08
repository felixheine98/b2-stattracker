import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { findLineupConflict } from "@/lib/lineups"

interface Params {
  params: Promise<{ id: string; lineupId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { lineupId } = await params
  const lineup = await db.tournamentLineup.findUnique({
    where: { id: lineupId },
    include: {
      slots: { include: { player: true } },
      matches: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { subMatches: true } } },
      },
    },
  })

  if (!lineup) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(lineup)
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  playerIds: z.array(z.string()).min(1).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, lineupId } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const playerIds = parsed.data.playerIds && [...new Set(parsed.data.playerIds)]
  if (playerIds) {
    const conflict = await findLineupConflict(id, playerIds, lineupId)
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
  }

  const lineup = await db.tournamentLineup.update({
    where: { id: lineupId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(playerIds !== undefined && {
        slots: {
          deleteMany: {},
          create: playerIds.map((playerId) => ({ playerId })),
        },
      }),
    },
    include: { slots: { include: { player: true } } },
  })

  return NextResponse.json(lineup)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { lineupId } = await params
  await db.tournamentLineup.delete({ where: { id: lineupId } })
  return new NextResponse(null, { status: 204 })
}
