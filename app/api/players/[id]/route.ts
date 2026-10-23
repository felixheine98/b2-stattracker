import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"
import { isCountryCode } from "@/lib/countries"
import { currentStatus, mayGetLogin } from "@/lib/player-status"

interface Params {
  params: Promise<{ id: string }>
}

// Link or unlink a user account to this player profile, set the player's country or nickname
// (docs/adr/009-spitznamen.md), or mark the player as inactive (does not drive competitions as
// a rule, see lib/planning.ts)
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json() as { userId?: string | null; country?: string | null; inactive?: unknown; nickname?: unknown }
  const { userId, country, inactive } = body
  // An emptied nickname removes it
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() || null : body.nickname

  // Validate everything before writing, so a rejected request changes nothing
  const target = await db.player.findUnique({ where: { id }, include: { statusChanges: true, user: { select: { id: true } } } })
  if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  if (country !== undefined && country !== null && !isCountryCode(country))
    return NextResponse.json({ error: "Unknown country" }, { status: 400 })

  if (inactive !== undefined && typeof inactive !== "boolean")
    return NextResponse.json({ error: "Inactive is either on or off" }, { status: 400 })

  if (nickname !== undefined && nickname !== null && typeof nickname !== "string")
    return NextResponse.json({ error: "The nickname is a text" }, { status: 400 })

  if (userId) {
    // Members and trials can link a new login; other statuses keep an existing link.
    if (!mayGetLogin(currentStatus(target)) && target.user?.id !== userId)
      return NextResponse.json({ error: "Only members and trials can be linked to an account" }, { status: 400 })

    // Verify user exists and isn't already linked to a different player
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.playerId && user.playerId !== id)
      return NextResponse.json({ error: "User is already linked to another player" }, { status: 409 })
  }

  await db.$transaction([
    ...(country !== undefined ? [db.player.update({ where: { id }, data: { country } })] : []),
    ...(inactive !== undefined ? [db.player.update({ where: { id }, data: { inactive } })] : []),
    ...(nickname !== undefined ? [db.player.update({ where: { id }, data: { nickname } })] : []),
    // Clear any existing link to this player first
    ...(userId !== undefined ? [db.user.updateMany({ where: { playerId: id }, data: { playerId: null } })] : []),
    ...(userId ? [db.user.update({ where: { id: userId }, data: { playerId: id } })] : []),
  ])

  const player = await db.player.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, username: true, role: true } } },
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
