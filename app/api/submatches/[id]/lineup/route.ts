import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const lineup = await db.lineup.findUnique({
    where: { subMatchId: id },
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
  const { id } = await params
  // Admins, managers and whoever is responsible for the lineup of this match
  const subMatch = await db.subMatch.findUnique({ where: { id }, select: { match: { select: { tournamentLineupId: true } } } })
  if (!subMatch) return NextResponse.json({ error: "Sub-match not found" }, { status: 404 })
  if (!(await mayEditLineupById(session.user as SessionUser, subMatch.match.tournamentLineupId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid player IDs" }, { status: 400 })
  }

  const lineup = await db.lineup.upsert({
    where: { subMatchId: id },
    create: {
      subMatchId: id,
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
