import { LINEUP_MANAGERS_INCLUDE } from "@/lib/lineup-access-db"
import { syncTournamentSlugs } from "@/lib/slugs-db"
import { withCompNames } from "@/lib/player-names-db"
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
  // Accounts responsible for the lineup
  managerUserIds: z.array(z.string()).optional(),
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
      ...(parsed.data.managerUserIds !== undefined && {
        managers: {
          deleteMany: {},
          create: [...new Set(parsed.data.managerUserIds)].map((userId) => ({ userId })),
        },
      }),
    },
    include: { slots: { include: { player: true } }, tournament: { select: { startDate: true, createdAt: true } }, ...LINEUP_MANAGERS_INCLUDE },
  })

  await syncTournamentSlugs(id)
  const { slug } = await db.tournamentLineup.findUniqueOrThrow({ where: { id: lineupId }, select: { slug: true } })

  return NextResponse.json(await withCompNames({ ...lineup, slug }, lineup.tournament))
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, lineupId } = await params
  // Matches always belong to a lineup, so they have to go (or move) first
  const matches = await db.match.count({ where: { tournamentLineupId: lineupId } })
  if (matches > 0) {
    return NextResponse.json(
      { error: `Dieses Lineup hat noch ${matches} Match${matches === 1 ? "" : "es"} und kann nicht gelöscht werden.` },
      { status: 409 }
    )
  }
  await db.tournamentLineup.delete({ where: { id: lineupId } })
  await syncTournamentSlugs(id)
  return new NextResponse(null, { status: 204 })
}
