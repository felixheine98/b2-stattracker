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
  tmId: true,
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

  // A new name is a rename with a date and goes through the name history instead
  if (action === "adopt" && field === "name") {
    return NextResponse.json({ error: "Rename the player through the name history" }, { status: 400 })
  }

  const data =
    action === "adopt"
      ? { country: value }
      : field === "name" ? { dismissedTmioName: value } : { dismissedTmioCountry: value }

  const updated = await db.player.update({ where: { id }, data, select: RESULT })
  return NextResponse.json(updated)
}

const relinkSchema = z.object({
  tmId: z.string().uuid().transform((v) => v.toLowerCase()),
})

// Point a player at another trackmania.io account, e.g. after the TM ID was entered wrongly.
// Results already recorded for the player move along to the new ID.
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = relinkSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { tmId } = parsed.data

  const player = await db.player.findUnique({ where: { id } })
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  const taken = await db.player.findFirst({ where: { tmId: { equals: tmId, mode: "insensitive" }, NOT: { id } } })
  if (taken) return NextResponse.json({ error: `This TM ID already belongs to ${taken.name}` }, { status: 409 })

  let found
  try {
    found = await fetchTmioPlayer(tmId)
  } catch (e: unknown) {
    if (e instanceof TmioError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
  if (!found) return NextResponse.json({ error: "trackmania.io does not know this TM ID" }, { status: 404 })

  try {
    const [, updated] = await db.$transaction([
      db.roundResult.updateMany({ where: { playerId: id }, data: { tmId } }),
      db.player.update({
        where: { id },
        data: {
          tmId,
          tmioName: found.name,
          tmioCountry: found.country,
          tmioCheckedAt: new Date(),
          ...(found.country && !player.country && { country: found.country }),
        },
        select: RESULT,
      }),
    ])
    return NextResponse.json(updated)
  } catch (e: unknown) {
    // A round already holds a separate result under the new ID
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A result with this TM ID already exists in one of the player's rounds" }, { status: 409 })
    }
    throw e
  }
}
