import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { fetchTmioPlayer, TmioError } from "@/lib/tmio"

interface Params {
  params: Promise<{ id: string }>
}

// The fields the players page needs after a comparison or after resolving a hint
const RESULT = {
  id: true,
  name: true,
  country: true,
  tmioName: true,
  tmioCountry: true,
  tmioCheckedAt: true,
  dismissedTmioName: true,
  dismissedTmioCountry: true,
} as const

// Compare one player with trackmania.io. Name and country are never overwritten;
// only an empty country is filled in. Differences are stored and shown as hints.
export async function POST(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const player = await db.player.findUnique({ where: { id } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  let found
  try {
    found = await fetchTmioPlayer(player.tmId)
  } catch (e: unknown) {
    if (e instanceof TmioError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const updated = await db.player.update({
    where: { id },
    data: {
      tmioName: found?.name ?? null,
      tmioCountry: found?.country ?? null,
      tmioCheckedAt: new Date(),
      ...(found?.country && !player.country && { country: found.country }),
    },
    select: RESULT,
  })

  return NextResponse.json(updated)
}

const resolveSchema = z.object({
  field: z.enum(["name", "country"]),
  action: z.enum(["adopt", "dismiss"]),
  // The value the user saw in the hint; guards against acting on a newer one unseen
  value: z.string().min(1),
})

// Resolve a hint: take over the trackmania.io value, or hide the hint until the value changes
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = resolveSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { field, action, value: seen } = parsed.data

  const player = await db.player.findUnique({ where: { id } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  const value = field === "name" ? player.tmioName : player.tmioCountry
  if (value !== seen) {
    const current = await db.player.findUnique({ where: { id }, select: RESULT })
    return NextResponse.json({ error: "The trackmania.io value has changed in the meantime", player: current }, { status: 409 })
  }

  const data =
    action === "adopt"
      ? field === "name" ? { name: value } : { country: value }
      : field === "name" ? { dismissedTmioName: value } : { dismissedTmioCountry: value }

  const updated = await db.player.update({ where: { id }, data, select: RESULT })
  return NextResponse.json(updated)
}
