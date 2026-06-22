import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string }>
}

// Link or unlink a user account to this player profile
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { userId } = await req.json() as { userId: string | null }

  // Clear any existing link to this player first
  await db.user.updateMany({ where: { playerId: id }, data: { playerId: null } })

  if (userId) {
    // Verify user exists and isn't already linked to a different player
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.playerId && user.playerId !== id)
      return NextResponse.json({ error: "User is already linked to another player" }, { status: 409 })

    await db.user.update({ where: { id: userId }, data: { playerId: id } })
  }

  const player = await db.player.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(player)
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const player = await db.player.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      roundResults: {
        include: { round: { select: { number: true, track: true, subMatch: { select: { match: { select: { tournament: { select: { name: true } } } } } } } } },
        orderBy: { round: { number: "asc" } },
      },
    },
  })

  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(player)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await db.player.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
