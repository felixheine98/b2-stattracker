import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { bumpPlanning, loadPlanning } from "@/lib/planning-db"
import { inTeam, statusAt, tournamentReferenceDate } from "@/lib/player-status"

interface Params {
  params: Promise<{ id: string; playerId: string }>
}

const schema = z.object({
  // A fixed level, "level:<id>" for an extra level of this planning, or "OPEN" for no answer
  answer: z.string().regex(/^(FIX|MAYBE|OUT|OPEN|level:.+)$/).optional(),
  note: z.string().trim().max(300).nullable().optional(),
})

const ARCHIVED = "The planning is closed: the tournament has its lineups."

// Set a player's availability and note. Everyone may do so for the player linked to their own
// account; admins and managers for anyone, which also puts a guest on the list.
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as { id?: string; role?: string }

  const { id, playerId } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { answer, note } = parsed.data

  const loaded = await loadPlanning(id)
  if (!loaded) return NextResponse.json({ error: "There is no planning for this tournament" }, { status: 404 })
  if (loaded.archived) return NextResponse.json({ error: ARCHIVED }, { status: 409 })

  const player = await db.player.findUnique({ where: { id: playerId }, include: { statusChanges: true, user: { select: { id: true } } } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  if (!canManage(user.role)) {
    if (!user.id || player.user?.id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    // Players answer only if they are on the list: members, and guests a manager added
    const onList =
      inTeam(statusAt(player, tournamentReferenceDate(loaded.tournament))) ||
      loaded.planning.entries.some((e) => e.playerId === playerId)
    if (!onList) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const levelId = answer?.startsWith("level:") ? answer.slice("level:".length) : null
  if (levelId && !loaded.planning.levels.some((l) => l.id === levelId)) {
    return NextResponse.json({ error: "This level no longer exists" }, { status: 400 })
  }
  const data = {
    ...(answer !== undefined && {
      status: answer === "FIX" || answer === "MAYBE" || answer === "OUT" ? (answer as "FIX" | "MAYBE" | "OUT") : null,
      levelId,
    }),
    ...(note !== undefined && { note: note || null }),
  }

  const entry = await db.planningEntry.upsert({
    where: { planningId_playerId: { planningId: loaded.planning.id, playerId } },
    create: { planningId: loaded.planning.id, playerId, ...data },
    update: data,
  })
  await bumpPlanning(loaded.planning.id)
  return NextResponse.json(entry)
}

// Take a player's answer back; a guest drops off the list with it
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, playerId } = await params
  const loaded = await loadPlanning(id)
  if (!loaded) return NextResponse.json({ error: "There is no planning for this tournament" }, { status: 404 })
  if (loaded.archived) return NextResponse.json({ error: ARCHIVED }, { status: 409 })

  await db.planningEntry.deleteMany({ where: { planningId: loaded.planning.id, playerId } })
  await bumpPlanning(loaded.planning.id)
  return new NextResponse(null, { status: 204 })
}
