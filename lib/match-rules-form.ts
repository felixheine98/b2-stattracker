// The format rules as the "Match rules" fields hold them: text until they are sent, so a field
// can be empty or half typed. What the routes take is described in lib/match-rules-db.ts.

export interface FormatRuleBody { roundsToWin: number | null; maxRounds: number | null }
export interface RulesBody {
  flow: string | null
  formatRules: Record<string, FormatRuleBody>
  points: { win: number | null; draw: number | null; loss: number | null } | null
}
export interface PlayoffRulesBody {
  formats: string[]
  flow: string | null
  formatRules: Record<string, FormatRuleBody>
}

export interface RulesDraft {
  flow: string
  formatRules: Record<string, { roundsToWin: string; maxRounds: string }>
  points: { win: string; draw: string; loss: string }
}
export interface PlayoffRulesDraft extends RulesDraft {
  formats: string[]
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n))
// What is not a number is sent as missing, so the check on the server names the field
const number = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null)

// Nothing is filled in for a rule set that does not exist yet
export function draftOf(body: Pick<RulesBody, "flow" | "formatRules"> & { points?: RulesBody["points"] } | null): RulesDraft {
  return {
    flow: body?.flow ?? "",
    formatRules: Object.fromEntries(
      Object.entries(body?.formatRules ?? {}).map(([format, r]) => [format, { roundsToWin: text(r.roundsToWin), maxRounds: text(r.maxRounds) }]),
    ),
    points: { win: text(body?.points?.win), draw: text(body?.points?.draw), loss: text(body?.points?.loss) },
  }
}

const formatRulesOf = (draft: RulesDraft) =>
  Object.fromEntries(Object.entries(draft.formatRules).map(([format, r]) => [format, { roundsToWin: number(r.roundsToWin), maxRounds: number(r.maxRounds) }]))

export function rulesBodyOf(draft: RulesDraft): RulesBody {
  return {
    flow: draft.flow || null,
    formatRules: formatRulesOf(draft),
    points: { win: number(draft.points.win), draw: number(draft.points.draw), loss: number(draft.points.loss) },
  }
}

export function playoffBodyOf(draft: PlayoffRulesDraft): PlayoffRulesBody {
  return { formats: draft.formats, flow: draft.flow || null, formatRules: formatRulesOf(draft) }
}

export function playoffDraftOf(body: PlayoffRulesBody | null): PlayoffRulesDraft | null {
  return body && { ...draftOf(body), formats: body.formats }
}
