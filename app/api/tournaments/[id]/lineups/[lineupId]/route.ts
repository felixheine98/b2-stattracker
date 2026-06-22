import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string; lineupId: string }>
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  playerIds: z.array(z.string()).min(1).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { lineupId } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const lineup = await db.tournamentLineup.update({
    where: { id: lineupId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.playerIds !== undefined && {
        slots: {
          deleteMany: {},
          create: parsed.data.playerIds.map((playerId) => ({ playerId })),
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
