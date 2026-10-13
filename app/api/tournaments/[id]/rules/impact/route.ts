import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { Format } from "@prisma/client"
import { canManage } from "@/lib/roles"
import { ruleChangeImpact, ruledFormats, type CompRules } from "@/lib/match-rules"
import { compRulesOf, playoffRulesSchema, readRuleSet, rulesInclude, rulesSchema } from "@/lib/match-rules-db"

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  formats: z.array(z.nativeEnum(Format)),
  rules: rulesSchema.nullable(),
  playoffRules: playoffRulesSchema.nullable(),
})

// What saving these rules would do to the closed matches of the tournament; nothing is changed
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { formats, rules, playoffRules } = parsed.data

  const after: CompRules = { comp: null, playoff: null }
  if (rules && ruledFormats(formats).length > 0) {
    const read = readRuleSet(formats, rules, "comp")
    if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 })
    after.comp = read.ruleSet
  }
  if (playoffRules) {
    const read = readRuleSet(playoffRules.formats, playoffRules, "playoff")
    if ("error" in read) return NextResponse.json({ error: `Playoffs: ${read.error}` }, { status: 400 })
    after.playoff = read.ruleSet
  }

  const tournament = await db.tournament.findUnique({
    where: { id },
    include: {
      ...rulesInclude,
      matches: {
        include: {
          stage: { select: { type: true } },
          subMatches: {
            orderBy: { order: "asc" },
            include: { rounds: { orderBy: { number: "asc" }, include: { results: { orderBy: [{ position: "asc" }, { timeMs: "asc" }] } } } },
          },
        },
      },
    },
  })
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const matches = tournament.matches.map((m) => ({ closed: m.closedAt !== null, stageType: m.stage.type, subMatches: m.subMatches }))
  return NextResponse.json(ruleChangeImpact(matches, compRulesOf(tournament), after))
}
