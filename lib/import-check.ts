// Checking an import of rounds (CSV of a match dumper, eCircuitMania) against the match it is
// saved to: opponent, own lineup and date. A deviation is a hint in the preview, never a block
// (see docs/adr/004-import-validierung.md).

export interface ImportDriver {
  // Trackmania account ID, in any case
  tmId: string
  name: string
}

export interface ImportHint {
  // Shown in the preview
  text: string
  // For the line an import despite hints leaves in the notes of the match
  short: string
}

// An opponent of the tournament with the drivers known for it: its roster, the roster of its
// fixed team and whoever drove for it in another match
export interface KnownOpponent {
  name: string
  knownTmIds: string[]
}

const ids = (tmIds: string[]) => new Set(tmIds.map((id) => id.toLowerCase()))

// Results saved without an account carry a placeholder instead (anonymous places, names from
// eCM, people not identified yet). They say nothing about who an account belongs to.
const isAccount = (tmId: string) => !/^(opponent|ecm|unknown)-/i.test(tmId)
const accounts = (tmIds: string[]) => ids(tmIds.filter(isAccount))

// Do the foreign drivers of an import belong to the entered opponent? Only what is known can
// speak against it: a new opponent and single new drivers of a known one raise nothing.
export function opponentHints(foreign: ImportDriver[], opponent: KnownOpponent | null, others: KnownOpponent[]): ImportHint[] {
  if (!opponent) return []
  const known = accounts(opponent.knownTmIds)
  const hints: ImportHint[] = []
  if (known.size > 0 && foreign.length > 0 && !foreign.some((d) => known.has(d.tmId.toLowerCase()))) {
    hints.push({ text: `None of the drivers known for ${opponent.name} is in this import.`, short: `no known driver of ${opponent.name}` })
  }
  for (const driver of foreign) {
    if (known.has(driver.tmId.toLowerCase())) continue
    const other = others.find((o) => accounts(o.knownTmIds).has(driver.tmId.toLowerCase()))
    if (other) hints.push({ text: `${driver.name} is known as a driver of ${other.name}.`, short: `${driver.name} drives for ${other.name}` })
  }
  return hints
}

// One of our lineups of the tournament with the accounts of its roster
export interface OwnLineup {
  name: string
  tmIds: string[]
}

// Are the sides of an import the ones of the lineup the match belongs to? A substitute from
// outside the roster is legitimate, so every hint names its driver and leaves the call to the user.
export function ownHints(ours: ImportDriver[], foreign: ImportDriver[], lineup: OwnLineup, otherLineups: OwnLineup[]): ImportHint[] {
  const roster = ids(lineup.tmIds)
  const hints: ImportHint[] = []
  for (const driver of ours) {
    if (roster.has(driver.tmId.toLowerCase())) continue
    const other = otherLineups.find((l) => ids(l.tmIds).has(driver.tmId.toLowerCase()))
    hints.push(other
      ? { text: `${driver.name} is in the roster of ${other.name}, not of ${lineup.name}.`, short: `${driver.name} is in the roster of ${other.name}` }
      : { text: `${driver.name} is not in the roster of ${lineup.name}.`, short: `${driver.name} not in the roster` })
  }
  for (const driver of foreign) {
    if (roster.has(driver.tmId.toLowerCase())) hints.push({ text: `${driver.name} is in the roster of ${lineup.name} but counted as an opponent.`, short: `${driver.name} counted as an opponent` })
  }
  return hints
}

export interface DateCheck {
  // Day of the first round in German local time, YYYY-MM-DD
  importDay: string
  // Day the match is dated, null when it has none
  matchDay: string | null
  // A match without a date does not differ: there the day is only offered
  differs: boolean
}

const germanDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" })

// Was the match started on the day it is dated? The start counts, so a match that runs past
// midnight fits. firstRoundTime is a Unix time in seconds, 0 or null when the source has none.
export function dateCheck(firstRoundTime: number | null, matchDay: string | null): DateCheck | null {
  if (!firstRoundTime) return null
  const importDay = germanDay.format(new Date(firstRoundTime * 1000))
  return { importDay, matchDay, differs: matchDay !== null && matchDay !== importDay }
}

const showDay = (day: string) => day.split("-").reverse().join(".")

// The hint for a date that differs and is not taken over from the import
export function dateHint(date: { importDay: string; matchDay: string }): ImportHint {
  return {
    text: `The rounds were driven on ${showDay(date.importDay)}, the match is dated ${showDay(date.matchDay)}.`,
    short: `rounds of ${showDay(date.importDay)}, match dated ${showDay(date.matchDay)}`,
  }
}

// Names are compared without case, spaces and punctuation
const nameKey = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "")

// Do the two teams on the eCircuitMania page fit the match? eCM has no account IDs, so the
// names are all there is to compare for the opponent.
export function teamNameHints(teams: { own: string; opponent: string }, lineupName: string, opponent: { name: string; aliases: string[] } | null): ImportHint[] {
  const hints: ImportHint[] = []
  if (opponent && ![opponent.name, ...opponent.aliases].some((n) => nameKey(n) === nameKey(teams.opponent))) {
    hints.push({ text: `The eCM page shows ${teams.opponent} as the opponent, the match is entered against ${opponent.name}.`, short: `eCM opponent ${teams.opponent} instead of ${opponent.name}` })
  }
  if (nameKey(teams.own) !== nameKey(lineupName)) {
    hints.push({ text: `The eCM page shows ${teams.own} as our team, the match belongs to ${lineupName}.`, short: `eCM team ${teams.own} instead of ${lineupName}` })
  }
  return hints
}

// The line an import despite hints leaves in the notes of the match; null without hints
export function importNoteLine(day: string, importer: string, hints: ImportHint[]): string | null {
  if (hints.length === 0) return null
  return `Import ${showDay(day)} (${importer}) despite warnings: ${hints.map((h) => h.short).join("; ")}.`
}

const IMPORT_NOTE = /^Import \d{2}\.\d{2}\.\d{4} \(.*\) despite warnings: /

// The notes of a match after an import: the line of the import before is replaced by the new
// one, or dropped when there is none. Whatever was written by hand stays.
export function withImportNote(notes: string | null, line: string | null): string | null {
  const kept = (notes ?? "").split("\n").filter((l) => !IMPORT_NOTE.test(l))
  const lines = line ? [...kept.filter((l, i) => l.trim() || i < kept.length - 1), line] : kept
  return lines.join("\n").trim() || null
}

// What is entered for the match an import goes to, as far as the check needs it
export interface ImportContext {
  lineup: OwnLineup
  // Our other lineups of the tournament
  otherLineups: OwnLineup[]
  // null for a match without an opponent, such as a seeding match
  opponent: (KnownOpponent & { aliases: string[] }) | null
  // The other opponents of the tournament
  otherOpponents: KnownOpponent[]
  matchDay: string | null
}

export interface ImportSides {
  ours: ImportDriver[]
  // The drivers on the other side whose account is known
  foreign: ImportDriver[]
  firstRoundTime: number | null
  // The two team names of an eCircuitMania page; a CSV has none
  teams?: { own: string; opponent: string }
}

// Everything the preview of an import shows before saving. An eCM import is compared by its
// team names instead of by the opponent's drivers, of whom it only has names.
export function checkImport(sides: ImportSides, context: ImportContext): { hints: ImportHint[]; date: DateCheck | null } {
  return {
    hints: [
      ...(sides.teams ? teamNameHints(sides.teams, context.lineup.name, context.opponent) : []),
      ...ownHints(sides.ours, sides.foreign, context.lineup, context.otherLineups),
      ...(sides.teams ? [] : opponentHints(sides.foreign, context.opponent, context.otherOpponents)),
    ],
    date: dateCheck(sides.firstRoundTime, context.matchDay),
  }
}
