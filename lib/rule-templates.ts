// Templates of format rules (docs/adr/005-comp-formatregeln.md): what one holds and the check
// before it is saved. A template is complete the way the rules of a new tournament have to be.
import { z } from "zod"
import { Format } from "@prisma/client"
import type { RuleSet } from "./match-rules"
import { playoffRulesSchema, readRuleSet, rulesBodies, rulesSchema } from "./match-rules-db"
import type { PlayoffRulesBody, RulesBody } from "./match-rules-form"

export interface TemplateContent {
  formats: string[]
  rules: RulesBody
  playoffRules: PlayoffRulesBody | null
}

export interface RuleTemplate extends TemplateContent {
  id: string
  name: string
}

export const templateContentSchema = z.object({
  formats: z.array(z.nativeEnum(Format)),
  rules: rulesSchema,
  playoffRules: playoffRulesSchema.nullable().optional(),
})

// The sent content checked like the rules of a tournament; rules of formats outside the
// sequence are dropped
export function readTemplate(input: z.infer<typeof templateContentSchema>): { error: string } | { content: TemplateContent } {
  const comp = readRuleSet(input.formats, input.rules, "comp")
  if ("error" in comp) return { error: comp.error }
  let playoff: RuleSet | null = null
  if (input.playoffRules) {
    const read = readRuleSet(input.playoffRules.formats, input.playoffRules, "playoff")
    if ("error" in read) return { error: `Playoffs: ${read.error}` }
    playoff = read.ruleSet
  }
  const bodies = rulesBodies({ comp: comp.ruleSet, playoff })
  return { content: { formats: input.formats, rules: bodies.rules!, playoffRules: bodies.playoffRules } }
}

export const toTemplate = (row: { id: string; name: string; content: unknown }): RuleTemplate => ({ id: row.id, name: row.name, ...(row.content as TemplateContent) })
