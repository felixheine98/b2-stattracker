import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"
import { isCountryCode } from "@/lib/countries"
import { currentStatus } from "@/lib/player-status"

interface Params {
  params: Promise<{ id: string }>
}

// Link or unlink a user account to this player profile, or set the player's country
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json() as { userId?: string | null; country?: string | null }
  const { userId, country } = body

  // Validate everything before writing, so a rejected request changes nothing
  const target = await db.player.findUnique({ where: { id }, include: { statusChanges: true, user: { select: { id: true } } } })
  if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  if (country !== undefined && country !== null && !isCountryCode(country))
    return NextResponse.json({ error: "Unknown country" }, { status: 400 })

  if (userId) {
    // Guests keep a login they already have, but never get a new one linked
    if (currentStatus(target) === "GUEST" && target.user?.id !== userId)
      return NextResponse.json({ error: "Guests cannot be linked to an account" }, { status: 400 })

    // Verify user exists and isn't already linked to a different player
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.playerId && user.playerId !== id)
      return NextResponse.json({ error: "User is already linked to another player" }, { status: 409 })
  }

  await db.$transaction([
    ...(country !== undefined ? [db.player.update({ where: { id }, data: { country } })] : []),
    // Clear any existing link to this player first
    ...(userId !== undefined ? [db.user.updateMany({ where: { playerId: id }, data: { playerId: null } })] : []),
    ...(userId ? [db.user.update({ where: { id: userId }, data: { playerId: id } })] : []),
  ])

  const player = await db.player.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, username: true } } },
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
