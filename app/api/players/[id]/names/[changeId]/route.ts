import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { syncPlayerName } from "@/lib/player-names-db"
import { isValidDay } from "@/lib/player-status"
import { latestAllowedDay } from "@/lib/player-status-rules"

interface Params {
  params: Promise<{ id: string; changeId: string }>
}

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  effectiveFrom: z.string().refine(isValidDay, "Invalid date").optional(),
})

// Correct the name or the day of a rename
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, changeId } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { name, effectiveFrom } = parsed.data

  const change = await db.playerNameChange.findUnique({ where: { id: changeId } })
  if (!change || change.playerId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (effectiveFrom && effectiveFrom > latestAllowedDay()) {
    return NextResponse.json({ error: "The date must not be in the future" }, { status: 400 })
  }

  try {
    await db.playerNameChange.update({
      where: { id: changeId },
      data: { ...(name && { name }), ...(effectiveFrom && { effectiveFrom: new Date(effectiveFrom) }) },
    })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "There is already a rename on this day" }, { status: 409 })
    }
    throw e
  }
  return NextResponse.json(await syncPlayerName(id))
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, changeId } = await params
  const change = await db.playerNameChange.findUnique({ where: { id: changeId } })
  if (!change || change.playerId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.playerNameChange.delete({ where: { id: changeId } })
  return NextResponse.json(await syncPlayerName(id))
}
