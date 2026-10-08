import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const players = await db.player.findMany({
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
  tmId: z.string().uuid(),
  // Category the player is created in; it applies "from the beginning"
  status: z.enum(["MEMBER", "GUEST"]).default("MEMBER"),
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
    const { name, tmId, status } = parsed.data
    const player = await db.player.create({
      data: { name, tmId, initialStatus: status },
      include: { statusChanges: true },
    })
    return NextResponse.json(player, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A player with this TM ID already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
