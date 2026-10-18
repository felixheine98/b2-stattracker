import { syncTournamentSlugs } from "@/lib/slugs-db"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { CompStyle, Format } from "@prisma/client"
import { canManage } from "@/lib/roles"
import { needsFormats } from "@/lib/comp-styles"
import { isValidDay } from "@/lib/player-status"
import { DEFAULT_STAGE_PLAN, planStageChanges } from "@/lib/stages"
import { ruledFormats, type RuleSet } from "@/lib/match-rules"
import { matchRulesEnabled } from "@/lib/features"
import { compRulesOf, playoffRulesSchema, readRuleSet, rulesBodies, rulesInclude, rulesSchema, rulesWrites } from "@/lib/match-rules-db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tournaments = await db.tournament.findMany({
    // The latest tournament first, by the day it starts
    orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { _count: { select: { matches: true } } },
  })

  return NextResponse.json(tournaments)
}

// What the tournament is divided into; the stages are created from it
const stagesSchema = z.object({
  seeding: z.boolean(),
  matchDays: z.number().int().min(1).max(20),
  playoffDays: z.number().int().min(0).max(10),
})

const createSchema = z.object({
  name: z.string().min(1),
  // May be empty for an endurance race only, see needsFormats
  formats: z.array(z.nativeEnum(Format)),
  // Required: every tournament has exactly one style
  style: z.nativeEnum(CompStyle, { message: "Select a style" }),
  description: z.string().nullable().optional(),
  // Required: the start day decides who counts as member or guest in this tournament
  startDate: z.string().refine(isValidDay, "A valid start date is required"),
  endDate: z.string().nullable().optional(),
  stages: stagesSchema.default(DEFAULT_STAGE_PLAN),
  // Required as soon as the tournament has formats that matches are played in
  rules: rulesSchema.optional(),
  playoffRules: playoffRulesSchema.nullable().optional(),
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
  if (needsFormats(parsed.data.style) && parsed.data.formats.length === 0) {
    return NextResponse.json({ error: "Select at least one format" }, { status: 400 })
  }

  let ruleSet: RuleSet | null = null, playoffRuleSet: RuleSet | null = null
  // Switched off, rules are neither asked for nor kept
  if (matchRulesEnabled() && ruledFormats(parsed.data.formats).length > 0) {
    if (!parsed.data.rules) return NextResponse.json({ error: "Enter the match rules" }, { status: 400 })
    const read = readRuleSet(parsed.data.formats, parsed.data.rules, "comp")
    if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 })
    ruleSet = read.ruleSet
    if (parsed.data.playoffRules) {
      const playoff = readRuleSet(parsed.data.playoffRules.formats, parsed.data.playoffRules, "playoff")
      if ("error" in playoff) return NextResponse.json({ error: `Playoffs: ${playoff.error}` }, { status: 400 })
      playoffRuleSet = playoff.ruleSet
    }
  }

  const tournament = await db.tournament.create({
    data: {
      name: parsed.data.name,
      formats: parsed.data.formats,
      style: parsed.data.style,
      description: parsed.data.description ?? null,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      stages: { create: planStageChanges([], parsed.data.stages).create },
    },
  })

  await db.$transaction([
    ...(ruleSet ? rulesWrites(db, tournament.id, false, ruleSet) : []),
    ...(playoffRuleSet ? rulesWrites(db, tournament.id, true, playoffRuleSet) : []),
  ])

  await syncTournamentSlugs(tournament.id)
  const saved = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id }, include: rulesInclude })

  return NextResponse.json({ ...tournament, slug: saved.slug, ...rulesBodies(compRulesOf(saved)) }, { status: 201 })
}
