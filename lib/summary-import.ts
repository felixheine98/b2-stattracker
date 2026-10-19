// Reads the file a comp's stats screenshots are transcribed into (docs/adr/007): one line per
// player and sub-match, and the comp's total tables to check them against. Names on the
// screenshots are resolved through the name list, which holds for all comps.
import type { Format } from "@prisma/client"
import type { Outcome } from "./match-rules"
import type { StageType } from "./stages"
import { teamSize } from "./utils"

// The #admins channel the screenshots were posted in
const CHANNEL_URL = "https://discord.com/channels/733887691258593280/1060207503046082592"

export interface NameEntry {
  name: string
  // null: Felix decided to leave the results under this name out
  tmId: string | null
  // The player's name, for reading the list
  player: string
  // From and until which day (YYYY-MM-DD) the name means this player; null: no limit
  from: string | null
  until: string | null
}

export interface PlannedPlayer {
  name: string
  tmId: string
  rounds: number
  // null: the screenshot gives no places (points instead), so the sub-match counts for the record only
  placementSum: number | null
  // Points instead of places, as some comps (FSM) list them
  points: number | null
}

export interface PlannedSubMatch {
  order: number
  format: Format
  track: string | null
  rounds: number
  roundsWon: number | null
  roundsLost: number | null
  outcome: Outcome
  sourceUrl: string
  // Message id and image number, as in the export's file names
  sourceImage: string
  players: PlannedPlayer[]
}

export interface PlannedMatch {
  team: string
  stage: { type: StageType; number: number }
  number: number
  opponent: string
  date: string | null
  subMatches: PlannedSubMatch[]
}

// A line of a total table: a player's rounds and places over the matches of a team in the given
// stages (null: all) and format
export interface PlannedTotal {
  line: number
  team: string
  stages: Array<{ type: StageType; number: number }> | null
  // As written in the file, to name it
  scope: string
  format: Format
  name: string
  tmId: string
  rounds: number
  // What the table sums up: places, or points where the comp gives them instead
  placementSum: number | null
  points: number | null
  sourceImage: string
}

export interface SummaryPlan {
  comp: string
  // The "# key: value" lines at the top, comp aside
  meta: Record<string, string>
  matches: PlannedMatch[]
  totals: PlannedTotal[]
  errors: string[]
}

export const FORMATS: Record<string, Format> = { "1v1": "ROUND_1V1", "2v2": "ROUND_2V2", "3v3": "ROUND_3V3", "4v4": "ROUND_4V4", "5v5": "ROUND_5V5" }
const STAGES: Record<string, StageType> = { S: "SEEDING", MD: "GROUP", PO: "PLAYOFF" }
const STAGE_KEYS: Record<StageType, string> = { SEEDING: "S", GROUP: "MD", PLAYOFF: "PO" }
const FORMAT_KEYS = Object.fromEntries(Object.entries(FORMATS).map(([k, v]) => [v, k])) as Record<Format, string>

// Tab-separated lines with a head line; empty lines and lines starting with "#" are skipped
function table(lines: Array<{ text: string; line: number }>): Array<{ line: number; cells: Record<string, string> }> {
  const rows = lines.filter((l) => l.text.trim() && !l.text.startsWith("#"))
  if (rows.length === 0) return []
  const head = rows[0].text.split("\t").map((h) => h.trim())
  return rows.slice(1).map(({ text, line }) => {
    const values = text.split("\t")
    return { line, cells: Object.fromEntries(head.map((h, i) => [h, (values[i] ?? "").trim()])) }
  })
}

export function parseNames(text: string): NameEntry[] {
  const lines = text.split("\n").map((t, i) => ({ text: t, line: i + 1 }))
  return table(lines).map(({ cells }) => ({
    name: cells.name,
    tmId: cells.tmId === "-" ? null : cells.tmId,
    player: cells.player ?? "",
    from: cells.from || null,
    until: cells.until || null,
  }))
}

// The entries a name may stand for on the given day
function lookup(names: NameEntry[], name: string, date: string | null): NameEntry[] {
  const key = name.toLowerCase()
  return names.filter((n) => n.name.toLowerCase() === key && (!date || ((!n.from || n.from <= date) && (!n.until || date <= n.until))))
}

const int = (text: string): number | null => (/^\d+$/.test(text) ? Number(text) : null)

export function planSummaryImport(text: string, names: NameEntry[]): SummaryPlan {
  const errors: string[] = []
  const meta: Record<string, string> = {}
  const sections = new Map<string, Array<{ text: string; line: number }>>()
  let section = ""
  text.split("\n").forEach((raw, i) => {
    const t = raw.replace(/\r$/, "")
    const heading = /^##\s*(\w+)/.exec(t)
    if (heading) { section = heading[1].toLowerCase(); return }
    const metaLine = /^#\s*([\w-]+)\s*:\s*(.*)$/.exec(t)
    if (metaLine && section === "") { meta[metaLine[1].toLowerCase()] = metaLine[2].trim(); return }
    if (!sections.has(section)) sections.set(section, [])
    sections.get(section)!.push({ text: t, line: i + 1 })
  })
  const comp = meta.comp ?? ""
  delete meta.comp
  if (!comp) errors.push("No \"# comp:\" line")

  const matches: PlannedMatch[] = []
  for (const { line, cells } of table(sections.get("matches") ?? [])) {
    const at = `line ${line}`
    const stage = parseStage(cells.stage)
    const format = FORMATS[cells.format.toLowerCase()]
    const number = int(cells.match)
    const order = int(cells.sub)
    const outcome = cells.outcome.toUpperCase()
    if (!stage) { errors.push(`${at}: stage "${cells.stage}" is not S, MDn or POn`); continue }
    if (!format) { errors.push(`${at}: format "${cells.format}" unknown`); continue }
    if (number === null || order === null) { errors.push(`${at}: match and sub must be numbers`); continue }
    if (outcome !== "W" && outcome !== "L" && outcome !== "D") { errors.push(`${at}: outcome must be W, L or D`); continue }
    const shot = /^(\d+)_(\d+)$/.exec(cells.screenshot)
    if (!shot) { errors.push(`${at}: screenshot must be "<message id>_<image number>"`); continue }
    const date = cells.date || null
    const roundsWon = cells.won ? int(cells.won) : null
    const roundsLost = cells.lost ? int(cells.lost) : null

    if (roundsWon !== null && roundsLost !== null && outcome !== (roundsWon > roundsLost ? "W" : roundsLost > roundsWon ? "L" : "D")) {
      errors.push(`${at}: ${roundsWon}:${roundsLost} does not fit outcome ${outcome}`)
      continue
    }

    let match = matches.find((m) => m.team === cells.team && m.stage.type === stage.type && m.stage.number === stage.number && m.number === number)
    if (!match) {
      match = { team: cells.team, stage, number, opponent: cells.opponent, date, subMatches: [] }
      matches.push(match)
    }
    const differs = [
      ...(match.opponent !== cells.opponent ? ["opponent"] : []),
      ...(match.date !== date ? ["date"] : []),
    ]
    differs.forEach((field) => errors.push(`${at}: ${field} differs from the match's first line`))
    let sm = match.subMatches.find((s) => s.order === order)
    if (!sm) {
      sm = {
        order, format, track: cells.map || null, rounds: 0, roundsWon, roundsLost, outcome,
        sourceUrl: `${CHANNEL_URL}/${shot[1]}`, sourceImage: cells.screenshot, players: [],
      }
      match.subMatches.push(sm)
    }
    const smDiffers = [
      ...(sm.format !== format ? ["format"] : []),
      ...(sm.track !== (cells.map || null) ? ["map"] : []),
      ...(sm.roundsWon !== roundsWon ? ["won"] : []),
      ...(sm.roundsLost !== roundsLost ? ["lost"] : []),
      ...(sm.outcome !== outcome ? ["outcome"] : []),
      ...(sm.sourceImage !== cells.screenshot ? ["screenshot"] : []),
    ]
    smDiffers.forEach((field) => errors.push(`${at}: ${field} differs from the sub-match's first line`))
    if (differs.length > 0 || smDiffers.length > 0) continue

    let rounds = int(cells.rounds)
    let placementSum = int(cells.places)
    // A 1v1 is often given only as its result: every round won is a first, every round lost a second place
    if (format === "ROUND_1V1" && rounds === null && placementSum === null && roundsWon !== null && roundsLost !== null) {
      rounds = roundsWon + roundsLost
      placementSum = roundsWon + 2 * roundsLost
    }
    const points = cells.points ? int(cells.points) : null
    if (rounds === null || (cells.places && placementSum === null) || (cells.points && points === null)) { errors.push(`${at}: rounds, places and points must be numbers`); continue }

    // The rounds of the sub-match: those of whoever drove the most, results left out included
    sm.rounds = Math.max(sm.rounds, rounds, (roundsWon ?? 0) + (roundsLost ?? 0))

    const found = lookup(names, cells.name, date)
    if (found.length === 0) { errors.push(`${at}: name "${cells.name}" is not in the name list`); continue }
    if (found.length > 1) { errors.push(`${at}: name "${cells.name}" stands for several players on ${date ?? "an unknown day"}`); continue }
    const tmId = found[0].tmId
    if (tmId === null) continue
    const field = 2 * (teamSize(format) ?? 1)
    if (placementSum !== null && placementSum < rounds) { errors.push(`${at}: ${placementSum} places in ${rounds} rounds is less than first place every round`); continue }
    if (placementSum !== null && placementSum > rounds * field) { errors.push(`${at}: ${placementSum} places in ${rounds} rounds is more than last place (${field}) every round`); continue }
    if (sm.players.some((p) => p.tmId === tmId)) { errors.push(`${at}: ${found[0].player} (${tmId}) is listed twice in this sub-match`); continue }
    sm.players.push({ name: cells.name, tmId, rounds, placementSum, points })
  }

  const totals: PlannedTotal[] = []
  for (const { line, cells } of table(sections.get("totals") ?? [])) {
    const at = `line ${line}`
    const format = FORMATS[cells.format.toLowerCase()]
    const stages = cells.stages === "*" ? null : cells.stages.split(",").map((key) => parseStage(key.trim()))
    const rounds = int(cells.rounds), placementSum = cells.places ? int(cells.places) : null, points = cells.points ? int(cells.points) : null
    if (!format) { errors.push(`${at}: format "${cells.format}" unknown`); continue }
    if (stages?.some((st) => st === null)) { errors.push(`${at}: stages must be "*" or a list such as MD1,MD2`); continue }
    if (rounds === null || (cells.places && placementSum === null) || (cells.points && points === null) || (placementSum === null && points === null)) {
      errors.push(`${at}: rounds and places or points must be numbers`)
      continue
    }
    // The day of the team's last match in scope decides what a nickname stands for
    const dates = matches.filter((m) => m.team === cells.team && inStages(m, stages as PlannedTotal["stages"])).map((m) => m.date).filter((d): d is string => !!d)
    const found = lookup(names, cells.name, dates.sort().at(-1) ?? null)
    if (found.length === 0) { errors.push(`${at}: name "${cells.name}" is not in the name list`); continue }
    if (found.length > 1) { errors.push(`${at}: name "${cells.name}" stands for several players`); continue }
    if (found[0].tmId === null) continue
    totals.push({ line, team: cells.team, stages: stages as PlannedTotal["stages"], scope: cells.stages, format, name: cells.name, tmId: found[0].tmId, rounds, placementSum, points, sourceImage: cells.screenshot })
  }

  return { comp, meta, matches, totals, errors }
}

function parseStage(key: string): { type: StageType; number: number } | null {
  const m = /^(S|MD|PO)(\d*)$/.exec(key)
  return m ? { type: STAGES[m[1]], number: Number(m[2] || 1) } : null
}

const inStages = (match: PlannedMatch, stages: PlannedTotal["stages"]) =>
  !stages || stages.some((st) => st.type === match.stage.type && st.number === match.stage.number)

// Compares the matches read with the total tables of the comp: every player whose sums differ,
// and every player of the matches missing in a total table
export function checkTotals(plan: SummaryPlan): string[] {
  const differences: string[] = []
  const groups = new Map<string, PlannedTotal[]>()
  for (const total of plan.totals) {
    const key = `${total.team}|${total.scope}|${total.format}`
    groups.set(key, [...(groups.get(key) ?? []), total])
  }
  for (const rows of groups.values()) {
    const { team, stages, scope, format, sourceImage } = rows[0]
    // A table sums up places, or points where the comp gives them instead
    const unit = rows[0].placementSum === null ? "points" : "places"
    const sums = new Map<string, { name: string; rounds: number; value: number }>()
    for (const match of plan.matches) {
      if (match.team !== team || !inStages(match, stages)) continue
      for (const sm of match.subMatches) {
        if (sm.format !== format) continue
        for (const p of sm.players) {
          const sum = sums.get(p.tmId) ?? { name: p.name, rounds: 0, value: 0 }
          sum.rounds += p.rounds
          sum.value += (unit === "points" ? p.points : p.placementSum) ?? 0
          sums.set(p.tmId, sum)
        }
      }
    }
    const label = `${team} ${scope} ${FORMAT_KEYS[format]}`
    for (const total of rows) {
      const sum = sums.get(total.tmId) ?? { rounds: 0, value: 0 }
      const value = unit === "points" ? total.points : total.placementSum
      if (sum.rounds !== total.rounds || sum.value !== value) {
        differences.push(`${label} ${total.name} (line ${total.line}): total ${total.rounds} rounds / ${value} ${unit}, matches ${sum.rounds} / ${sum.value}`)
      }
    }
    for (const [tmId, sum] of sums) {
      if (sum.rounds > 0 && !rows.some((t) => t.tmId === tmId)) {
        differences.push(`${label} ${sum.name}: ${sum.rounds} rounds / ${sum.value} ${unit} in the matches, not in the total (screenshot ${sourceImage})`)
      }
    }
  }
  return differences
}

export function matchLabel(match: Pick<PlannedMatch, "team" | "stage" | "number">): string {
  return `${match.team} ${STAGE_KEYS[match.stage.type]}${match.stage.type === "SEEDING" ? "" : match.stage.number} #${match.number}`
}

// What may be a reading mistake but need not be one: sub-matches whose player rounds do not add
// up to a full team in every round (a player missing on the screenshot, or a typo)
export function summaryWarnings(plan: SummaryPlan): string[] {
  const warnings: string[] = []
  for (const match of plan.matches) {
    for (const sm of match.subMatches) {
      const full = sm.rounds * (teamSize(sm.format) ?? 1)
      const driven = sm.players.reduce((sum, p) => sum + p.rounds, 0)
      if (driven !== full) warnings.push(`${matchLabel(match)} sub ${sm.order} (${FORMAT_KEYS[sm.format]}): ${driven} player rounds, a full team drives ${full}`)
    }
  }
  return warnings
}
