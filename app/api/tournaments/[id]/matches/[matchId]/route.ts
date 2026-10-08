import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      subMatches: {
        orderBy: { order: "asc" },
        include: {
          lineup: { include: { slots: { include: { player: true } } } },
          rounds: {
            orderBy: { number: "asc" },
            include: { results: { orderBy: [{ position: "asc" }, { timeMs: "asc" }] } },
          },
        },
      },
    },
  })

  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(match)
}

const patchSchema = z.object({
  tournamentLineupId: z.string().nullable(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { matchId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { tournamentLineupId } = parsed.data

  // Fetch lineup players if a lineup is being set
  let playerIds: string[] = []
  if (tournamentLineupId) {
    const tl = await db.tournamentLineup.findUnique({
      where: { id: tournamentLineupId },
      include: { slots: { select: { playerId: true } } },
    })
    if (!tl) return NextResponse.json({ error: "Lineup not found" }, { status: 404 })
    playerIds = tl.slots.map((s) => s.playerId)
  }

  // Update match + propagate lineup to all sub-matches in a transaction
  const subMatches = await db.subMatch.findMany({ where: { matchId }, select: { id: true } })

  await db.$transaction([
    db.match.update({ where: { id: matchId }, data: { tournamentLineupId } }),
    ...subMatches.map((sm) =>
      playerIds.length > 0
        ? db.lineup.upsert({
            where: { subMatchId: sm.id },
            create: { subMatchId: sm.id, slots: { create: playerIds.map((playerId) => ({ playerId })) } },
            update: { slots: { deleteMany: {}, create: playerIds.map((playerId) => ({ playerId })) } },
          })
        : db.lineup.deleteMany({ where: { subMatchId: sm.id } })
    ),
  ])

  const updated = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournamentLineup: { select: { id: true, name: true, slots: { include: { player: true } } } },
      subMatches: {
        orderBy: { order: "asc" },
        include: {
          lineup: { include: { slots: { include: { player: true } } } },
          rounds: {
            orderBy: { number: "asc" },
            include: {
              results: {
                orderBy: [{ position: "asc" }, { timeMs: "asc" }],
                include: { player: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { matchId } = await params
  await db.match.delete({ where: { id: matchId } })
  return new NextResponse(null, { status: 204 })
}
