// Reading and writing the format rules of a tournament (docs/adr/005-comp-formatregeln.md);
// what they mean is in lib/match-rules.ts
import { z } from "zod"
import { Format, type MatchFlow, type Prisma, type PrismaClient } from "@prisma/client"
import { checkRuleSet, ruledFormats, type CompRules, type RuleSet } from "./match-rules"
import type { PlayoffRulesBody, RulesBody } from "./match-rules-form"

const formatRulesSchema = z.record(
  z.string(),
  z.object({ roundsToWin: z.number().nullable(), maxRounds: z.number().nullable().optional() }),
)
const pointsSchema = z.object({ win: z.number().nullable(), draw: z.number().nullable(), loss: z.number().nullable() })

// The rule set of the competition as it is sent; its format sequence is the tournament's own
export const rulesSchema = z.object({ flow: z.string().nullable(), formatRules: formatRulesSchema, points: pointsSchema.nullable() })
// The playoffs bring their own sequence and score no points
export const playoffRulesSchema = z.object({ formats: z.array(z.nativeEnum(Format)), flow: z.string().nullable(), formatRules: formatRulesSchema })

type SentRules = z.infer<typeof rulesSchema>

export const rulesInclude = { matchRules: { include: { formatRules: true } } } satisfies Prisma.TournamentInclude

type RulesRow = Prisma.MatchRulesGetPayload<{ include: { formatRules: true } }>
interface WithRules { formats: Format[]; matchRules: RulesRow[] }

function toRuleSet(row: RulesRow, formats: Format[]): RuleSet {
  return {
    formats,
    flow: row.flow,
    // Only what the sequence still has: a format that left it keeps no rule
    formatRules: Object.fromEntries(
      row.formatRules.filter((r) => formats.includes(r.format)).map((r) => [r.format, { roundsToWin: r.roundsToWin, maxRounds: r.maxRounds }]),
    ),
    points: row.pointsWin === null || row.pointsDraw === null || row.pointsLoss === null ? null : { win: row.pointsWin, draw: row.pointsDraw, loss: row.pointsLoss },
  }
}

export function compRulesOf(tournament: WithRules): CompRules {
  const comp = tournament.matchRules.find((r) => !r.playoff)
  const playoff = tournament.matchRules.find((r) => r.playoff)
  return { comp: comp ? toRuleSet(comp, tournament.formats) : null, playoff: playoff ? toRuleSet(playoff, playoff.formats) : null }
}

// The rules the way the routes give and take them
export function rulesBodies(rules: CompRules): { rules: RulesBody | null; playoffRules: PlayoffRulesBody | null } {
  return {
    rules: rules.comp && { flow: rules.comp.flow, formatRules: rules.comp.formatRules, points: rules.comp.points },
    playoffRules: rules.playoff && { formats: rules.playoff.formats, flow: rules.playoff.flow, formatRules: rules.playoff.formatRules },
  }
}

// A sent rule set checked against its format sequence. Rules of formats outside the sequence
// are dropped.
export function readRuleSet(formats: string[], body: Omit<SentRules, "points"> & { points?: SentRules["points"] }, kind: "comp" | "playoff"): { error: string } | { ruleSet: RuleSet } {
  const kept = new Set(ruledFormats(formats))
  const input = {
    formats,
    flow: body.flow,
    formatRules: Object.fromEntries(
      Object.entries(body.formatRules).filter(([format]) => kept.has(format)).map(([format, r]) => [format, { roundsToWin: r.roundsToWin, maxRounds: r.maxRounds ?? null }]),
    ),
    points: body.points ?? null,
  }
  const error = checkRuleSet(input, kind)
  return error ? { error } : { ruleSet: input as RuleSet }
}

// Replaces one of the two rule sets of a tournament; null removes it. For a transaction.
export function rulesWrites(db: PrismaClient, tournamentId: string, playoff: boolean, ruleSet: RuleSet | null): Prisma.PrismaPromise<unknown>[] {
  const remove = db.matchRules.deleteMany({ where: { tournamentId, playoff } })
  if (!ruleSet) return [remove]
  return [
    remove,
    db.matchRules.create({
      data: {
        tournamentId,
        playoff,
        formats: playoff ? (ruleSet.formats as Format[]) : [],
        flow: ruleSet.flow as MatchFlow,
        pointsWin: ruleSet.points?.win ?? null,
        pointsDraw: ruleSet.points?.draw ?? null,
        pointsLoss: ruleSet.points?.loss ?? null,
        formatRules: { create: Object.entries(ruleSet.formatRules).map(([format, r]) => ({ format: format as Format, ...r })) },
      },
    }),
  ]
}
