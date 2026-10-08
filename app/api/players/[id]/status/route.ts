import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { currentStatus, dayKey, isValidDay, sortedChanges } from "@/lib/player-status"
import { latestAllowedDay } from "@/lib/player-status-rules"

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  status: z.enum(["MEMBER", "GUEST"]),
  effectiveFrom: z.string().refine(isValidDay, "Invalid date"),
})

// Move a player between team members and guests from the given day on
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { status, effectiveFrom } = parsed.data

  const player = await db.player.findUnique({ where: { id }, include: { statusChanges: true } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  if (currentStatus(player) === status) {
    return NextResponse.json({ error: "Player already has this status" }, { status: 409 })
  }
  if (effectiveFrom > latestAllowedDay()) {
    return NextResponse.json({ error: "The date must not be in the future" }, { status: 400 })
  }
  const last = sortedChanges(player).at(-1)
  if (last && effectiveFrom <= dayKey(last.effectiveFrom)) {
    return NextResponse.json({ error: "The date must be after the previous switch" }, { status: 400 })
  }

  try {
    await db.playerStatusChange.create({
      data: { playerId: id, status, effectiveFrom: new Date(effectiveFrom) },
    })
  } catch (e: unknown) {
    // Someone else switched this player on the same day in the meantime
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "There is already a switch on this day" }, { status: 409 })
    }
    throw e
  }

  const statusChanges = await db.playerStatusChange.findMany({ where: { playerId: id }, orderBy: { effectiveFrom: "asc" } })
  return NextResponse.json({ statusChanges }, { status: 201 })
}
