import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { dayKey, isValidDay } from "@/lib/player-status"
import { latestAllowedDay } from "@/lib/player-status-rules"

interface Params {
  params: Promise<{ id: string; changeId: string }>
}

const schema = z.object({
  effectiveFrom: z.string().refine(isValidDay, "Invalid date"),
})

async function loadChanges(playerId: string) {
  return db.playerStatusChange.findMany({ where: { playerId }, orderBy: { effectiveFrom: "asc" } })
}

// Correct the day of a switch; it has to stay between its neighbours
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, changeId } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { effectiveFrom } = parsed.data

  const changes = await loadChanges(id)
  const index = changes.findIndex((c) => c.id === changeId)
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (effectiveFrom > latestAllowedDay()) {
    return NextResponse.json({ error: "The date must not be in the future" }, { status: 400 })
  }
  const previous = changes[index - 1]
  const next = changes[index + 1]
  if (previous && effectiveFrom <= dayKey(previous.effectiveFrom)) {
    return NextResponse.json({ error: "The date must be after the previous switch" }, { status: 400 })
  }
  if (next && effectiveFrom >= dayKey(next.effectiveFrom)) {
    return NextResponse.json({ error: "The date must be before the next switch" }, { status: 400 })
  }

  try {
    await db.playerStatusChange.update({ where: { id: changeId }, data: { effectiveFrom: new Date(effectiveFrom) } })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "There is already a switch on this day" }, { status: 409 })
    }
    throw e
  }
  return NextResponse.json({ statusChanges: await loadChanges(id) })
}

// Only the most recent switch can be removed, otherwise the history would not alternate
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, changeId } = await params
  const changes = await loadChanges(id)
  const last = changes.at(-1)
  if (!changes.some((c) => c.id === changeId)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (last?.id !== changeId) {
    return NextResponse.json({ error: "Only the most recent switch can be removed" }, { status: 400 })
  }

  await db.playerStatusChange.delete({ where: { id: changeId } })
  return NextResponse.json({ statusChanges: await loadChanges(id) })
}
