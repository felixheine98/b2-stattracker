import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { bumpPlanning, loadPlanning, loadVariants } from "@/lib/planning-db"
import { defaultLineupNames, nextVariantName } from "@/lib/planning-variants"

interface Params {
  params: Promise<{ id: string }>
}

const name = z.string().trim().min(1).max(60)
const note = z.string().trim().max(1000).nullable()

// One change to the lineup variants; mirrors VariantAction in lib/planning-variants.ts
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("createVariant"), copyFrom: z.string().optional(), lineupCount: z.number().int().min(1).max(12).optional() }),
  z.object({ type: z.literal("updateVariant"), variantId: z.string(), name: name.optional(), note: note.optional() }),
  z.object({ type: z.literal("deleteVariant"), variantId: z.string() }),
  z.object({ type: z.literal("addLineup"), variantId: z.string(), name }),
  z.object({ type: z.literal("updateLineup"), lineupId: z.string(), name: name.optional(), note: note.optional() }),
  z.object({ type: z.literal("deleteLineup"), lineupId: z.string() }),
  z.object({ type: z.literal("placePlayer"), variantId: z.string(), playerId: z.string(), lineupId: z.string().nullable() }),
  z.object({ type: z.literal("notePlayer"), variantId: z.string(), playerId: z.string(), note }),
  z.object({ type: z.literal("vote"), variantId: z.string(), on: z.boolean() }),
])

// The variants are for admins and managers only: players do not see them
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const loaded = await loadPlanning(id)
  if (!loaded) return NextResponse.json({ error: "There is no planning for this tournament" }, { status: 404 })
  return NextResponse.json({ variants: await loadVariants(loaded.planning.id) })
}

// Apply one change and answer with all variants as they are afterwards
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as { id?: string; role?: string }
  if (!canManage(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const action = parsed.data

  const loaded = await loadPlanning(id)
  if (!loaded) return NextResponse.json({ error: "There is no planning for this tournament" }, { status: 404 })
  if (loaded.archived) return NextResponse.json({ error: "The planning is closed: the tournament has its lineups." }, { status: 409 })
  const planningId = loaded.planning.id
  // Working on the variants again (the tournament lost its lineups) voids an earlier adoption
  if (loaded.planning.adoptedVariantId) await db.planning.update({ where: { id: planningId }, data: { adoptedVariantId: null } })

  // Everything addressed has to belong to this planning
  const ownVariant = (variantId: string) => db.planningVariant.findFirst({ where: { id: variantId, planningId } })
  const ownLineup = (lineupId: string) => db.planningVariantLineup.findFirst({ where: { id: lineupId, variant: { planningId } } })
  const missing = () => NextResponse.json({ error: "This no longer exists – please reload the page." }, { status: 404 })

  switch (action.type) {
    case "createVariant": {
      const existing = await db.planningVariant.findMany({ where: { planningId }, select: { name: true } })
      const names = existing.map((v) => v.name)
      if (action.copyFrom) {
        const source = await db.planningVariant.findFirst({
          where: { id: action.copyFrom, planningId },
          include: { lineups: { orderBy: { createdAt: "asc" } }, slots: { orderBy: { createdAt: "asc" } } },
        })
        if (!source) return missing()
        const copy = await db.planningVariant.create({ data: { planningId, name: nextVariantName(names, source.name), note: source.note } })
        // One by one, so lineups and players keep their order
        const copied = new Map<string, string>()
        for (const lineup of source.lineups) {
          const created = await db.planningVariantLineup.create({ data: { variantId: copy.id, name: lineup.name, note: lineup.note } })
          copied.set(lineup.id, created.id)
        }
        for (const slot of source.slots) {
          await db.planningVariantSlot.create({
            data: { variantId: copy.id, lineupId: slot.lineupId ? copied.get(slot.lineupId) ?? null : null, playerId: slot.playerId, note: slot.note },
          })
        }
        break
      }
      // A new variant starts with as many empty lineups as asked for, under their usual names
      const variant = await db.planningVariant.create({ data: { planningId, name: nextVariantName(names) } })
      for (const lineupName of defaultLineupNames(action.lineupCount ?? 4)) {
        await db.planningVariantLineup.create({ data: { variantId: variant.id, name: lineupName } })
      }
      break
    }
    case "updateVariant": {
      if (!(await ownVariant(action.variantId))) return missing()
      await db.planningVariant.update({
        where: { id: action.variantId },
        data: { ...(action.name !== undefined && { name: action.name }), ...(action.note !== undefined && { note: action.note || null }) },
      })
      break
    }
    case "deleteVariant": {
      await db.planningVariant.deleteMany({ where: { id: action.variantId, planningId } })
      break
    }
    case "addLineup": {
      if (!(await ownVariant(action.variantId))) return missing()
      await db.planningVariantLineup.create({ data: { variantId: action.variantId, name: action.name } })
      break
    }
    case "updateLineup": {
      if (!(await ownLineup(action.lineupId))) return missing()
      await db.planningVariantLineup.update({
        where: { id: action.lineupId },
        data: { ...(action.name !== undefined && { name: action.name }), ...(action.note !== undefined && { note: action.note || null }) },
      })
      break
    }
    case "deleteLineup": {
      // Its players go back to the pool and keep their notes
      await db.planningVariantLineup.deleteMany({ where: { id: action.lineupId, variant: { planningId } } })
      break
    }
    case "placePlayer": {
      if (!(await ownVariant(action.variantId))) return missing()
      const where = { variantId_playerId: { variantId: action.variantId, playerId: action.playerId } }
      if (action.lineupId === null) {
        // Back to the pool; the row stays only if it still carries a note
        await db.planningVariantSlot.updateMany({ where: { variantId: action.variantId, playerId: action.playerId }, data: { lineupId: null } })
        await db.planningVariantSlot.deleteMany({ where: { variantId: action.variantId, playerId: action.playerId, lineupId: null, note: null } })
        break
      }
      const lineup = await db.planningVariantLineup.findFirst({ where: { id: action.lineupId, variantId: action.variantId } })
      if (!lineup) return missing()
      await db.planningVariantSlot.upsert({
        where,
        create: { variantId: action.variantId, lineupId: lineup.id, playerId: action.playerId },
        update: { lineupId: lineup.id },
      })
      break
    }
    case "notePlayer": {
      if (!(await ownVariant(action.variantId))) return missing()
      await db.planningVariantSlot.upsert({
        where: { variantId_playerId: { variantId: action.variantId, playerId: action.playerId } },
        create: { variantId: action.variantId, playerId: action.playerId, note: action.note || null },
        update: { note: action.note || null },
      })
      await db.planningVariantSlot.deleteMany({ where: { variantId: action.variantId, playerId: action.playerId, lineupId: null, note: null } })
      break
    }
    case "vote": {
      if (!user.id || !(await ownVariant(action.variantId))) return missing()
      const where = { variantId_userId: { variantId: action.variantId, userId: user.id } }
      if (action.on) await db.planningVote.upsert({ where, create: { variantId: action.variantId, userId: user.id }, update: {} })
      else await db.planningVote.deleteMany({ where: { variantId: action.variantId, userId: user.id } })
      break
    }
  }

  const revision = await bumpPlanning(planningId)
  return NextResponse.json({ variants: await loadVariants(planningId), revision })
}
