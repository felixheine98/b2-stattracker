import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { buildPlanningState } from "@/lib/planning-db"
import { planningPresence } from "@/lib/planning-presence"

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  // The revision the page already shows; the state is only sent when there is a newer one
  revision: z.number().int(),
  activity: z.object({
    variantId: z.string().nullable(),
    playerId: z.string().nullable(),
    typing: z.string().max(200).nullable(),
  }),
})

// Called by every open planning page every second or two: reports what the viewer is doing
// and answers with what changed since, plus who else is there.
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as { id?: string; name?: string | null; role?: string }
  if (!user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const planning = await db.planning.findUnique({
    where: { tournamentId: id },
    select: { revision: true, tournament: { select: { _count: { select: { tournamentLineups: true } } } } },
  })
  if (!planning) return NextResponse.json({ error: "Für diese Comp läuft keine Planung" }, { status: 404 })

  const mayManage = canManage(user.role)
  const now = Date.now()
  // What players do is none of anyone's business; only the managers' session is shared
  if (mayManage) planningPresence.touch(id, { id: user.id, name: user.name ?? "?" }, parsed.data.activity, now)

  let state = null
  if (planning.revision !== parsed.data.revision) {
    const self = await db.user.findUnique({ where: { id: user.id }, select: { playerId: true } })
    state = await buildPlanningState(id, { userId: user.id, canManage: mayManage, playerId: self?.playerId ?? null })
  }

  return NextResponse.json({
    revision: planning.revision,
    // Lineups can appear without the planning itself changing; then it is closed
    archived: planning.tournament._count.tournamentLineups > 0,
    state,
    presence: mayManage ? planningPresence.list(id, now).filter((p) => p.userId !== user.id) : [],
  })
}
