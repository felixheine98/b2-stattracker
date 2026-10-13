// The format rules of a competition (docs/adr/005-comp-formatregeln.md): the one place that
// decides who won a sub-match and a match, whether that state is finished, and what does not
// fit the rules.
import type { Format } from "@prisma/client"
import { roundScore, type ScoredResult } from "./round-score"
import { formatLabel as label } from "./utils"

const formatLabel = (format: string) => label(format as Format) ?? format

export type Outcome = "W" | "L" | "D"

// How a sub-match of one format is decided: by the first side with roundsToWin rounds, or after
// maxRounds rounds (null: no limit) by whoever won more
export interface FormatRule {
  roundsToWin: number
  maxRounds: number | null
}

export interface RuleRound {
  // In finishing order
  results: ScoredResult[]
}

// empty: no round that both teams drove; unruled: its format has no rule
export type SubMatchStatus = "empty" | "unruled" | "decided" | "incomplete" | "overplayed"

export interface SubMatchState {
  won: number
  lost: number
  drawn: number
  // From our team's perspective; whoever won more rounds, whether the sub-match is decided or not
  outcome: Outcome | null
  status: SubMatchStatus
  hint: string | null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : word.endsWith("ch") ? "es" : "s"}`

// rounds must be in the order they were driven. Level rounds count towards the round limit but
// for neither side.
export function subMatchState(rounds: RuleRound[], rule: FormatRule | null): SubMatchState {
  let won = 0, lost = 0, drawn = 0, after = 0, decided = false
  for (const round of rounds) {
    const outcome = roundScore(round.results)?.outcome
    if (!outcome) continue
    if (decided) after++
    if (outcome === "W") won++
    else if (outcome === "L") lost++
    else drawn++
    if (rule && (Math.max(won, lost) >= rule.roundsToWin || (rule.maxRounds !== null && won + lost + drawn >= rule.maxRounds))) decided = true
  }
  const tally = { won, lost, drawn }
  if (won + lost + drawn === 0) return { ...tally, outcome: null, status: "empty", hint: null }
  const outcome: Outcome = won > lost ? "W" : lost > won ? "L" : "D"
  if (!rule) return { ...tally, outcome, status: "unruled", hint: null }
  if (!decided) return { ...tally, outcome, status: "incomplete", hint: `${won}:${lost} – target ${rule.roundsToWin} not reached` }
  if (after > 0) return { ...tally, outcome, status: "overplayed", hint: `${won}:${lost} – ${plural(after, "round")} after it was decided` }
  return { ...tally, outcome, status: "decided", hint: null }
}

// ALL: every sub-match of the sequence is played. UNTIL_DECIDED: the match ends once a side has
// won the majority of the sequence (best of). DECIDER: the last sub-match of the sequence is
// only played when the others end level.
export type MatchFlow = "ALL" | "UNTIL_DECIDED" | "DECIDER"

export interface RuleSet {
  // The format sequence these rules belong to
  formats: string[]
  flow: MatchFlow
  // By format; a format of the sequence without an entry has no rule
  formatRules: Record<string, FormatRule>
  // For the result of a group match; null where matches score no points (playoffs)
  points: { win: number; draw: number; loss: number } | null
}

export interface RuleSubMatch {
  format: string
  rounds: RuleRound[]
}

export interface MatchReport {
  // One state per sub-match, in the given order
  subMatches: SubMatchState[]
  won: number
  lost: number
  drawn: number
  // Whoever won more sub-matches; null while none has been played
  outcome: Outcome | null
  // What does not fit the flow of the match as a whole; those of the sub-matches are in their states
  hints: string[]
}

// The sub-matches a match is played in; a time attack is the seeding, not part of a match
export const ruledFormats = (formats: string[]) => formats.filter((f) => f !== "TIME_ATTACK_10")

function flowHints(played: Outcome[], ruleSet: RuleSet): string[] {
  const expected = ruledFormats(ruleSet.formats).length
  const count = (outcomes: Outcome[], o: Outcome) => outcomes.filter((x) => x === o).length
  const won = count(played, "W"), lost = count(played, "L")
  if (played.length === 0) return []
  if (played.length > expected) return [`${plural(played.length, "sub-match")} played, the format has ${expected}`]

  if (ruleSet.flow === "ALL") {
    return played.length < expected ? [`${played.length} of ${expected} sub-matches played`] : []
  }
  if (ruleSet.flow === "UNTIL_DECIDED") {
    const needed = Math.floor(expected / 2) + 1
    let w = 0, l = 0
    const decidedAt = played.findIndex((o) => { if (o === "W") w++; if (o === "L") l++; return Math.max(w, l) >= needed })
    if (decidedAt === -1) return [`${won}:${lost} – no side has the ${plural(needed, "sub-match")} needed`]
    const after = played.length - decidedAt - 1
    return after > 0 ? [`${plural(after, "sub-match")} played after the match was decided`] : []
  }
  const regular = played.slice(0, expected - 1)
  const w = count(regular, "W"), l = count(regular, "L")
  if (regular.length < expected - 1) return [`${regular.length} of ${expected - 1} sub-matches played`]
  if (played.length < expected) return w === l ? [`${w}:${l} – decider missing`] : []
  if (w !== l) return [`Decider played although the match stood ${w}:${l}`]
  return won === lost ? [`${won}:${lost} – still level after the decider`] : []
}

// subMatches in the order they were played. Without a rule set there is nothing to check, and
// the result is the one of the sub-matches alone.
export function matchReport(subMatches: RuleSubMatch[], ruleSet: RuleSet | null): MatchReport {
  const states = subMatches.map((sm) => subMatchState(sm.rounds, ruleSet?.formatRules[sm.format] ?? null))
  const played = states.flatMap((s) => (s.outcome ? [s.outcome] : []))
  const won = played.filter((o) => o === "W").length
  const lost = played.filter((o) => o === "L").length
  return {
    subMatches: states,
    won,
    lost,
    drawn: played.length - won - lost,
    outcome: played.length === 0 ? null : won > lost ? "W" : lost > won ? "L" : "D",
    hints: ruleSet ? flowHints(played, ruleSet) : [],
  }
}

export interface CompRules {
  comp: RuleSet | null
  // The playoffs' own rule set; without one they follow the competition's
  playoff: RuleSet | null
}

// The rules a match of this stage is played by; a seeding match has none
export function ruleSetFor(rules: CompRules, stageType: string): RuleSet | null {
  if (stageType === "SEEDING") return null
  return stageType === "PLAYOFF" ? rules.playoff ?? rules.comp : rules.comp
}

// Points only exist in the group stage, where the league keeps a table
export function matchPoints(outcome: Outcome | null, ruleSet: RuleSet | null, stageType: string): number | null {
  if (!outcome || !ruleSet?.points || stageType !== "GROUP") return null
  return outcome === "W" ? ruleSet.points.win : outcome === "D" ? ruleSet.points.draw : ruleSet.points.loss
}

// A rule set as it is typed in, where everything may still be missing
export interface RuleSetInput {
  formats: string[]
  flow: string | null
  formatRules: Record<string, { roundsToWin: number | null; maxRounds: number | null }>
  points: { win: number | null; draw: number | null; loss: number | null } | null
}

const FLOWS: string[] = ["ALL", "UNTIL_DECIDED", "DECIDER"] satisfies MatchFlow[]
const whole = (n: number | null | undefined, min: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min

// What keeps a rule set from being saved, or null. Nothing is filled in for the user: the flow,
// the rounds to win of every format and, for the competition, the points have to be given.
export function checkRuleSet(input: RuleSetInput, kind: "comp" | "playoff"): string | null {
  const formats = [...new Set(ruledFormats(input.formats))]
  if (formats.length === 0) return "Select at least one format"
  if (!input.flow || !FLOWS.includes(input.flow)) return "Select how a match is decided"
  if (input.flow === "DECIDER" && ruledFormats(input.formats).length < 2) return "A decider needs at least two formats in the sequence"
  for (const format of formats) {
    const rule = input.formatRules[format]
    if (!whole(rule?.roundsToWin, 1)) return `Enter the rounds to win for ${formatLabel(format)}`
    if (rule.maxRounds !== null && !whole(rule.maxRounds, 1)) return `Enter a whole number as max rounds for ${formatLabel(format)}, or leave it empty`
    if (rule.maxRounds !== null && rule.maxRounds < rule.roundsToWin) return `Max rounds for ${formatLabel(format)} cannot be lower than its rounds to win`
  }
  if (kind === "playoff") return input.points ? "Playoff matches score no points" : null
  if (!input.points || !whole(input.points.win, 0) || !whole(input.points.draw, 0) || !whole(input.points.loss, 0)) return "Enter the points for a win, a draw and a loss"
  return null
}

export interface RuledMatch {
  closed: boolean
  stageType: string
  subMatches: RuleSubMatch[]
}

// Every hint of a match, those of its sub-matches first
export function allHints(report: MatchReport): string[] {
  return [...report.subMatches.flatMap((s) => (s.hint ? [s.hint] : [])), ...report.hints]
}

// The same for the dialog that closes the match: there a sub-match needs its place and format
export function closingHints(subMatches: Array<{ format: string }>, report: MatchReport): string[] {
  return [
    ...report.subMatches.flatMap((s, i) => (s.hint ? [`${i + 1}. ${formatLabel(subMatches[i].format)}: ${s.hint}`] : [])),
    ...report.hints,
  ]
}

// What changing the rules of a competition does to its closed matches: how many there are, and
// how many of them would show a hint they do not show now
export function ruleChangeImpact(matches: RuledMatch[], before: CompRules, after: CompRules): { closed: number; newHints: number } {
  let closed = 0, newHints = 0
  for (const match of matches) {
    const rules = ruleSetFor(after, match.stageType)
    if (!match.closed || !rules) continue
    closed++
    const old = new Set(allHints(matchReport(match.subMatches, ruleSetFor(before, match.stageType))))
    if (allHints(matchReport(match.subMatches, rules)).some((hint) => !old.has(hint))) newHints++
  }
  return { closed, newHints }
}

export interface ScoredMatch {
  stageType: string
  subMatches: RuleSubMatch[]
  closedAt?: Date | string | null
  confirmedOutcome?: string | null
}

// The result of a match: the one confirmed when closing it, otherwise the one its sub-matches give
export function resultOf(match: ScoredMatch): Outcome | null {
  const confirmed = match.confirmedOutcome
  if (match.closedAt && (confirmed === "W" || confirmed === "L" || confirmed === "D")) return confirmed
  return matchReport(match.subMatches, null).outcome
}

// What a lineup has scored in the group stage, to compare with the table of the league; null
// when the tournament has no rules. A match without a result does not count yet.
export function lineupPoints(matches: ScoredMatch[], rules: CompRules): number | null {
  if (!rules.comp?.points) return null
  let sum = 0
  for (const match of matches) sum += matchPoints(resultOf(match), ruleSetFor(rules, match.stageType), match.stageType) ?? 0
  return sum
}
