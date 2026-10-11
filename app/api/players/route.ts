import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { isCountryCode } from "@/lib/countries"
import { isValidDay } from "@/lib/player-status"
import { latestAllowedDay } from "@/lib/player-status-rules"
import { syncPlayerSlugs } from "@/lib/slugs-db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const players = await db.player.findMany({ where: { isOpponentOnly: false },
    include: {
      user: { select: { id: true, name: true, email: true } },
      statusChanges: { orderBy: { effectiveFrom: "asc" } },
      _count: { select: { roundResults: true } },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(players)
}

const createSchema = z.object({
  name: z.string().min(1),
  // Stored in lower case so the same account cannot be added twice in different spelling
  tmId: z.string().uuid().transform((v) => v.toLowerCase()),
  // Category the player is created in; it applies "from the beginning"
  status: z.enum(["MEMBER", "TRIAL", "GUEST"]).default("MEMBER"),
  // Day the player joined (as member or on trial). With it the status no longer applies "from
  // the beginning": before that day the player counts as a guest.
  since: z.string().refine(isValidDay, "Invalid date").optional(),
  country: z.string().refine(isCountryCode, "Unknown country").nullable().optional(),
  // Set when the player was picked from the trackmania.io search
  tmio: z
    .object({
      name: z.string().min(1).max(100),
      country: z.string().refine(isCountryCode, "Unknown country").nullable(),
    })
    .optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const { name, tmId, status, country, tmio } = parsed.data
    const since = status === "GUEST" ? undefined : parsed.data.since
    if (since && since > latestAllowedDay()) return NextResponse.json({ error: "The date must not be in the future" }, { status: 400 })
    const opponent = await db.player.findUnique({ where: { tmId } })
    const data = {
        name,
        initialName: name,
        tmId,
        initialStatus: since ? ("GUEST" as const) : status,
        country: country ?? null,
        isOpponentOnly: false,
        ...(tmio && {
          tmioName: tmio.name,
          tmioCountry: tmio.country,
          tmioCheckedAt: new Date(),
          // A name changed while adding is deliberate, so no hint for it
          ...(tmio.name !== name && { dismissedTmioName: tmio.name }),
        }),
    }
    const include = { statusChanges: true, nameChanges: true } as const
    const player = opponent?.isOpponentOnly
      ? await db.player.update({ where: { id: opponent.id }, data, include })
      : await db.player.create({ data, include })
    if (since) {
      player.statusChanges = [await db.playerStatusChange.create({ data: { playerId: player.id, status, effectiveFrom: new Date(since) } })]
    }
    await syncPlayerSlugs()
    return NextResponse.json(player, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A player with this TM ID already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
