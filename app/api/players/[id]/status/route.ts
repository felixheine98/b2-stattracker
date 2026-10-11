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
  status: z.enum(["MEMBER", "TRIAL", "GUEST", "FORMER"]),
  effectiveFrom: z.string().refine(isValidDay, "Invalid date"),
})

// Give a player another status (member, trial, guest, former) from the given day on
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { status, effectiveFrom } = parsed.data

  const player = await db.player.findUnique({ where: { id }, include: { statusChanges: true, user: { select: { id: true, role: true } } } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  // Whoever leaves the team loses the login. An admin or manager has to hand over the role first.
  const login = status === "FORMER" ? player.user : null
  if (login && login.role !== "PLAYER") {
    return NextResponse.json({ error: "Der Account ist Admin oder Manager. Ändere zuerst die Rolle auf der Accounts-Seite." }, { status: 409 })
  }

  if (currentStatus(player) === status) {
    return NextResponse.json({ error: "Der Spieler hat diesen Status schon" }, { status: 409 })
  }
  if (effectiveFrom > latestAllowedDay()) {
    return NextResponse.json({ error: "Das Datum darf nicht in der Zukunft liegen" }, { status: 400 })
  }
  const last = sortedChanges(player).at(-1)
  if (last && effectiveFrom <= dayKey(last.effectiveFrom)) {
    return NextResponse.json({ error: "Das Datum muss nach dem letzten Wechsel liegen" }, { status: 400 })
  }

  try {
    await db.$transaction([
      db.playerStatusChange.create({ data: { playerId: id, status, effectiveFrom: new Date(effectiveFrom) } }),
      ...(login ? [db.user.delete({ where: { id: login.id } })] : []),
    ])
  } catch (e: unknown) {
    // Someone else switched this player on the same day in the meantime
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "An diesem Tag gibt es schon einen Wechsel" }, { status: 409 })
    }
    throw e
  }

  const statusChanges = await db.playerStatusChange.findMany({ where: { playerId: id }, orderBy: { effectiveFrom: "asc" } })
  return NextResponse.json({ statusChanges, loginDeleted: !!login }, { status: 201 })
}
