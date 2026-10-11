import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { planNameFrom } from "@/lib/player-names"
import { syncPlayerName } from "@/lib/player-names-db"
import { isValidDay } from "@/lib/player-status"
import { latestAllowedDay } from "@/lib/player-status-rules"

interface Params {
  params: Promise<{ id: string }>
}

const nameSchema = z.string().trim().min(1).max(100)

const schema = z.object({
  name: nameSchema,
  effectiveFrom: z.string().refine(isValidDay, "Invalid date"),
  // Today in the user's time zone. When given, a rename dated in the past must not change
  // today's name: it is kept with a second entry from today on, unless a later rename follows.
  keepCurrentFrom: z.string().refine(isValidDay, "Invalid date").optional(),
})

// Rename a player from the given day on; a rename already entered for that day is replaced
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { name, effectiveFrom, keepCurrentFrom } = parsed.data

  const player = await db.player.findUnique({ where: { id }, include: { nameChanges: true } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })
  if (effectiveFrom > latestAllowedDay() || (keepCurrentFrom && keepCurrentFrom > latestAllowedDay())) {
    return NextResponse.json({ error: "The date must not be in the future" }, { status: 400 })
  }

  const entries = keepCurrentFrom ? planNameFrom(player, name, effectiveFrom, keepCurrentFrom) : [{ name, effectiveFrom }]
  await db.$transaction(
    entries.map((entry) =>
      db.playerNameChange.upsert({
        where: { playerId_effectiveFrom: { playerId: id, effectiveFrom: new Date(entry.effectiveFrom) } },
        create: { playerId: id, name: entry.name, effectiveFrom: new Date(entry.effectiveFrom) },
        update: { name: entry.name },
      })
    )
  )
  return NextResponse.json(await syncPlayerName(id), { status: 201 })
}

// Correct the name the player has "from the beginning"
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = z.object({ initialName: nameSchema }).safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const player = await db.player.findUnique({ where: { id } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  await db.player.update({ where: { id }, data: { initialName: parsed.data.initialName } })
  return NextResponse.json(await syncPlayerName(id))
}
