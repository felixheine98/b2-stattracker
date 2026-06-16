import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const lineup = await db.lineup.findUnique({
    where: { matchId },
    include: { slots: { include: { player: true } } },
  })

  return NextResponse.json(lineup)
}

const schema = z.object({
  playerIds: z.array(z.string()),
})

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid player IDs" }, { status: 400 })
  }

  const lineup = await db.lineup.upsert({
    where: { matchId },
    create: {
      matchId,
      slots: {
        create: parsed.data.playerIds.map((playerId) => ({ playerId })),
      },
    },
    update: {
      slots: {
        deleteMany: {},
        create: parsed.data.playerIds.map((playerId) => ({ playerId })),
      },
    },
    include: { slots: { include: { player: true } } },
  })

  return NextResponse.json(lineup)
}
