import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { buildPlanningState, bumpPlanning } from "@/lib/planning-db"
import { adoptionPlan } from "@/lib/planning-variants"
import { syncTournamentSlugs } from "@/lib/slugs-db"

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({ variantId: z.string() })

// Take a variant over into the tournament: its lineups become the tournament's lineups.
// With that the planning is closed and stays as a read-only archive.
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as { id?: string; role?: string }
  if (!user.id || !canManage(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const state = await buildPlanningState(id, { userId: user.id, canManage: true, playerId: null })
  if (!state) return NextResponse.json({ error: "Für diese Comp läuft keine Planung" }, { status: 404 })
  if (state.archived) return NextResponse.json({ error: "Die Comp hat bereits Lineups." }, { status: 409 })
  const variant = state.variants?.find((v) => v.id === parsed.data.variantId)
  if (!variant) return NextResponse.json({ error: "Diese Variante gibt es nicht mehr – bitte die Seite neu laden." }, { status: 404 })

  const plan = adoptionPlan(variant, state.rows)
  if (plan.lineups.length === 0) return NextResponse.json({ error: "In dieser Variante ist noch niemand eingeteilt." }, { status: 400 })

  const planning = await db.planning.findUniqueOrThrow({ where: { tournamentId: id }, select: { id: true } })
  await db.$transaction(async (tx) => {
    // One by one, so the lineups keep the order of the variant
    for (const lineup of plan.lineups) {
      await tx.tournamentLineup.create({
        data: { tournamentId: id, name: lineup.name, slots: { create: lineup.playerIds.map((playerId) => ({ playerId })) } },
      })
    }
    await tx.planning.update({ where: { id: planning.id }, data: { adoptedVariantId: variant.id } })
  })
  await syncTournamentSlugs(id)
  await bumpPlanning(planning.id)

  return NextResponse.json({ lineups: plan.lineups.length }, { status: 201 })
}
