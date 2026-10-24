import { isTfhTournament } from "@/lib/tfh-db"
import { syncTournamentSlugs } from "@/lib/slugs-db"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { CompStyle, Format, Prisma } from "@prisma/client"
import { canManage } from "@/lib/roles"
import { needsFormats } from "@/lib/comp-styles"
import { isValidDay } from "@/lib/player-status"
import { planStageChanges, sortStages, stageName } from "@/lib/stages"
import { ruledFormats, type RuleSet } from "@/lib/match-rules"
import { matchRulesEnabled } from "@/lib/features"
import { readSeeding, seedingInput } from "@/lib/seeding"
import { compRulesOf, playoffRulesSchema, readRuleSet, rulesBodies, rulesInclude, rulesSchema, rulesWrites } from "@/lib/match-rules-db"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const tournament = await db.tournament.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { subMatches: true } },
        },
      },
    },
  })

  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(tournament)
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  // May be empty for an endurance race only, see needsFormats
  formats: z.array(z.nativeEnum(Format).refine((f) => f !== "SEEDING_RUN", "A seeding run is not a format of the matches")).optional(),
  // The style can be changed but not removed
  style: z.nativeEnum(CompStyle, { message: "Select a style" }).optional(),
  description: z.string().nullable().optional(),
  // The start date can be changed but not removed
  startDate: z.string().refine(isValidDay, "A valid start date is required").optional(),
  endDate: z.string().nullable().optional(),
  // Stages are added and removed at the end of their kind
  stages: z
    .object({
      seeding: z.boolean(),
      matchDays: z.number().int().min(1).max(20),
      playoffDays: z.number().int().min(0).max(10),
    })
    .optional(),
  // Left out: unchanged. A tournament from before the rules stays without until they are sent.
  rules: rulesSchema.optional(),
  // Null removes the playoffs' own rule set
  playoffRules: playoffRulesSchema.nullable().optional(),
  // Null removes the seeding format; left out: unchanged
  seeding: seedingInput.optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  if (await isTfhTournament(id)) return NextResponse.json({ error: "TFH races and lineups are maintained through the TFH import preview." }, { status: 409 })
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, formats, style, description, startDate, endDate, stages, rules, playoffRules } = parsed.data
  const seeding = parsed.data.seeding === undefined ? null : readSeeding(parsed.data.seeding)
  if (seeding && "error" in seeding) return NextResponse.json({ error: seeding.error }, { status: 400 })

  if (formats !== undefined || style !== undefined) {
    const current = await db.tournament.findUnique({ where: { id }, select: { style: true, formats: true } })
    if (current && needsFormats(style ?? current.style) && (formats ?? current.formats).length === 0) {
      return NextResponse.json({ error: "Select at least one format" }, { status: 400 })
    }
  }

  // The rules always cover the format sequence: checked again whenever either of them changes.
  // Switched off, they are left as they are.
  let ruleWrites: ReturnType<typeof rulesWrites> = []
  if (matchRulesEnabled() && (formats !== undefined || rules !== undefined || playoffRules !== undefined)) {
    const current = await db.tournament.findUnique({ where: { id }, include: rulesInclude })
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const sequence = formats ?? current.formats
    const body = rules ?? rulesBodies(compRulesOf(current)).rules
    let ruleSet: RuleSet | null = null
    if (body && ruledFormats(sequence).length > 0) {
      const read = readRuleSet(sequence, body, "comp")
      if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 })
      ruleSet = read.ruleSet
    }
    if (body) ruleWrites = rulesWrites(db, id, false, ruleSet)
    if (playoffRules === null) ruleWrites.push(...rulesWrites(db, id, true, null))
    else if (playoffRules) {
      const read = readRuleSet(playoffRules.formats, playoffRules, "playoff")
      if ("error" in read) return NextResponse.json({ error: `Playoffs: ${read.error}` }, { status: 400 })
      ruleWrites.push(...rulesWrites(db, id, true, read.ruleSet))
    }
  }

  const existing = await db.stage.findMany({ where: { tournamentId: id }, include: { _count: { select: { matches: true } } } })
  const changes = stages
    ? planStageChanges(existing.map((s) => ({ ...s, matchCount: s._count.matches })), stages)
    : { create: [], remove: [], blocked: [] }
  // A stage with matches is never removed; nothing is changed until they are moved or deleted
  if (changes.blocked.length > 0) {
    const names = sortStages(changes.blocked).map((s) => stageName(s, existing)).join(", ")
    return NextResponse.json({ error: `There are still matches in: ${names}` }, { status: 409 })
  }

  const [tournament] = await db.$transaction([
    db.tournament.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(formats !== undefined && { formats }),
        ...(style !== undefined && { style }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(seeding && { seedingType: seeding.seedingType, seedingSettings: seeding.seedingSettings ?? Prisma.DbNull }),
      },
    }),
    db.stage.deleteMany({ where: { id: { in: changes.remove } } }),
    db.stage.createMany({ data: changes.create.map((s) => ({ ...s, tournamentId: id })) }),
    ...ruleWrites,
  ])
  const saved = await db.stage.findMany({ where: { tournamentId: id } })
  // Name and stages are part of the addresses
  await syncTournamentSlugs(id)
  const after = await db.tournament.findUniqueOrThrow({ where: { id }, include: rulesInclude })

  return NextResponse.json({ ...tournament, slug: after.slug, stages: saved, ...rulesBodies(compRulesOf(after)) })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await db.tournament.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
