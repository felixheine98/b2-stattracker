import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { matchdayPlanningEnabled } from "@/lib/features"
import { mayEditLineup, sessionUser } from "@/lib/lineup-access-db"
import { publishedSnapshot } from "@/lib/matchday-plan"
import { emptyVariant, findPlanLineup, loadPlan } from "@/lib/matchday-plan-db"

interface Params {
  params: Promise<{ id: string; lineupId: string; stageId: string }>
}

// Who may plan: the lineup's managers (until a week after the tournament) and admins and managers
async function access({ params }: Params) {
  if (!matchdayPlanningEnabled()) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  const user = await sessionUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const { id, lineupId, stageId } = await params
  const lineup = await findPlanLineup(id, lineupId, stageId)
  if (!lineup) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  if (!mayEditLineup(user, lineup)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { lineup, stageId }
}

export async function GET(_req: Request, ctx: Params) {
  const found = await access(ctx)
  if ("error" in found) return found.error
  return NextResponse.json(await loadPlan(found.lineup.id, found.stageId))
}

const FORMATS = ["ROUND_1V1", "ROUND_2V2", "ROUND_3V3", "ROUND_4V4", "ROUND_5V5", "TIME_ATTACK_10"] as const
const seatsSchema = z.partialRecord(z.enum(FORMATS), z.array(z.string().nullable()).max(5))
const variantSchema = z.object({ day: seatsSchema, matches: z.record(z.string(), seatsSchema) })

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), playerId: z.string(), answer: z.enum(["FIX", "PARTIAL", "MAYBE", "OUT"]).nullable(), note: z.string().trim().max(300).nullable().optional() }),
  z.object({ action: z.literal("absence"), playerId: z.string(), matchId: z.string(), absent: z.boolean() }),
  z.object({ action: z.literal("addVariant"), name: z.string().trim().min(1).max(60), copyOf: z.string().optional() }),
  z.object({ action: z.literal("renameVariant"), variantId: z.string(), name: z.string().trim().min(1).max(60) }),
  z.object({ action: z.literal("deleteVariant"), variantId: z.string() }),
  z.object({ action: z.literal("seats"), variantId: z.string(), seats: variantSchema }),
  z.object({ action: z.literal("publish"), variantId: z.string() }),
])

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(req: Request, ctx: Params) {
  const found = await access(ctx)
  if ("error" in found) return found.error
  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return bad(parsed.error.issues[0].message)
  const body = parsed.data

  const plan = await loadPlan(found.lineup.id, found.stageId)
  const inKader = (playerId: string) => plan.kader.some((p) => p.id === playerId)
  const variant = "variantId" in body ? plan.variants.find((v) => v.id === body.variantId) : undefined
  if ("variantId" in body && !variant) return bad("Unknown variant", 404)

  switch (body.action) {
    case "answer": {
      if (!inKader(body.playerId)) return bad("The player is not in the lineup")
      // An answer set by hand clears the time of a Discord reaction
      const data = { answer: body.answer, answeredAt: null, ...(body.note !== undefined && { note: body.note || null }) }
      await db.matchdayPlanAnswer.upsert({ where: { planId_playerId: { planId: plan.planId, playerId: body.playerId } }, create: { planId: plan.planId, playerId: body.playerId, ...data }, update: data })
      break
    }
    case "absence": {
      if (!inKader(body.playerId)) return bad("The player is not in the lineup")
      if (!plan.matches.some((m) => m.id === body.matchId)) return bad("The match is not part of this match day")
      const key = { planId_playerId_matchId: { planId: plan.planId, playerId: body.playerId, matchId: body.matchId } }
      if (body.absent) await db.matchdayPlanAbsence.upsert({ where: key, create: { planId: plan.planId, playerId: body.playerId, matchId: body.matchId }, update: {} })
      else await db.matchdayPlanAbsence.deleteMany({ where: { planId: plan.planId, playerId: body.playerId, matchId: body.matchId } })
      break
    }
    case "addVariant": {
      const source = body.copyOf ? plan.variants.find((v) => v.id === body.copyOf) : undefined
      if (body.copyOf && !source) return bad("Unknown variant", 404)
      await db.matchdayVariant.create({ data: { planId: plan.planId, name: body.name, seats: (source?.seats ?? emptyVariant()) as unknown as Prisma.InputJsonValue } })
      break
    }
    case "renameVariant":
      await db.matchdayVariant.update({ where: { id: body.variantId }, data: { name: body.name } })
      break
    case "deleteVariant":
      if (plan.variants.length <= 1) return bad("The last variant cannot be deleted")
      if (plan.publishedVariantId === body.variantId) return bad("The finalised variant cannot be deleted; finalise another one first")
      await db.matchdayVariant.delete({ where: { id: body.variantId } })
      break
    case "seats": {
      const ids = [body.seats.day, ...Object.values(body.seats.matches)].flatMap((seats) => Object.values(seats).flat()).filter((id): id is string => id !== null)
      if (ids.some((id) => !inKader(id))) return bad("Only players of the lineup can be planned")
      if (Object.keys(body.seats.matches).some((matchId) => !plan.matches.some((m) => m.id === matchId))) return bad("The match is not part of this match day")
      await db.matchdayVariant.update({ where: { id: body.variantId }, data: { seats: body.seats as unknown as Prisma.InputJsonValue } })
      break
    }
    case "publish":
      await db.matchdayPlan.update({
        where: { id: plan.planId },
        data: { published: publishedSnapshot(variant!.seats, plan.matches) as unknown as Prisma.InputJsonValue, publishedVariantId: variant!.id, publishedAt: new Date() },
      })
      break
  }
  return NextResponse.json(await loadPlan(found.lineup.id, found.stageId))
}
