// Reading the CSV a match dumper writes for a whole match: one row per driver and round, all
// maps in a row. The file knows neither teams nor sub-matches and has no row for a driver who
// did not finish, so all of that is worked out here and shown to the user before saving.

export interface CsvEntry {
  // Trackmania account ID, lower case
  tmId: string
  name: string
  // null: did not finish
  timeMs: number | null
}

export interface CsvRound {
  // Identifies the round within one import
  key: string
  track: string
  number: number
  // Unix time of the first finish, in seconds
  time: number
  // In finishing order
  entries: CsvEntry[]
}

// A run of rounds that belongs to one sub-match
export interface CsvBlock {
  track: string
  rounds: CsvRound[]
}

export interface BlockDriver {
  tmId: string
  name: string
  // Rounds with a row for this driver
  rounds: number
}

const REQUIRED = ["time", "track", "playerid", "playername", "record", "roundnumber"]

// Double blanks are a common slip in map names
const cleanTrack = (track: string) => track.replace(/\s+/g, " ").trim()

function parseFile(csv: string, fileIndex: number): CsvRound[] {
  const lines = csv.replace(/^﻿/, "").trim().split(/\r?\n/)
  const headers = (lines[0] ?? "").split(",").map((h) => h.trim().toLowerCase())
  if (REQUIRED.some((name) => !headers.includes(name))) {
    throw new Error("Invalid CSV: columns are missing (Time, Track, PlayerID, PlayerName, Record, RoundNumber)")
  }
  const col = (name: string) => headers.indexOf(name)
  const roundIdCol = col("roundid")

  const rounds: CsvRound[] = []
  const byKey = new Map<string, CsvRound>()
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split(",").map((c) => c.trim())
    const track = cleanTrack(cells[col("track")] ?? "")
    const number = parseInt(cells[col("roundnumber")])
    const time = parseInt(cells[col("time")])
    const record = parseInt(cells[col("record")])
    const tmId = (cells[col("playerid")] ?? "").toLowerCase()
    if (!tmId || Number.isNaN(number)) continue

    // Without a round ID the rows of a round are those in a row with the same map and number
    const roundId = roundIdCol === -1 ? "" : cells[roundIdCol] ?? ""
    const last = rounds.at(-1)
    const key = roundId || (last && last.track === track && last.number === number ? last.key : `${fileIndex}:${rounds.length}`)
    let round = byKey.get(key)
    if (!round) {
      round = { key, track, number, time: Number.isNaN(time) ? 0 : time, entries: [] }
      byKey.set(key, round)
      rounds.push(round)
    }
    if (!Number.isNaN(time) && time < round.time) round.time = time
    if (!round.entries.some((e) => e.tmId === tmId)) {
      round.entries.push({ tmId, name: cells[col("playername")] ?? tmId, timeMs: record > 0 ? record : null })
    }
  }
  for (const round of rounds) {
    round.entries.sort((a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity))
  }
  return rounds
}

// One or several files of the same match. A new block starts with every file, when the map
// changes and when the round number goes back (the server started over on the same map).
// Files are put in the order they were driven; a round that a later file repeats is dropped.
export function parseMatchCsv(files: string[]): CsvBlock[] {
  const parsed = files
    .map((csv, i) => parseFile(csv, i))
    .filter((rounds) => rounds.length > 0)
    .sort((a, b) => Math.min(...a.map((r) => r.time)) - Math.min(...b.map((r) => r.time)))

  const blocks: CsvBlock[] = []
  const seen = new Set<string>()
  for (const rounds of parsed) {
    let block: CsvBlock | null = null
    for (const round of rounds) {
      if (seen.has(round.key)) continue
      seen.add(round.key)
      const previous: CsvRound | undefined = block?.rounds.at(-1)
      if (!block || !previous || previous.track !== round.track || round.number < previous.number) {
        block = { track: round.track, rounds: [] }
        blocks.push(block)
      }
      block.rounds.push(round)
    }
  }
  return blocks
}

export function blockDrivers(block: CsvBlock, selected?: Set<string>): BlockDriver[] {
  const drivers = new Map<string, BlockDriver>()
  for (const round of block.rounds) {
    if (selected && !selected.has(round.key)) continue
    for (const entry of round.entries) {
      const driver = drivers.get(entry.tmId) ?? { tmId: entry.tmId, name: entry.name, rounds: 0 }
      driver.rounds++
      drivers.set(entry.tmId, driver)
    }
  }
  return [...drivers.values()]
}

// The rounds that are left out unless the user says otherwise, each with the reason: an
// incomplete first round (the dumper started in the middle of one, or during the warm-up) and
// rounds in which less than half of the drivers finished. A round that only misses someone who
// did not finish is kept. teamSize is the number of players per team; without it the fullest
// round of the block is the measure.
export function suspiciousRounds(block: CsvBlock, teamSize: number | null): Map<string, string> {
  const finished = (round: CsvRound) => round.entries.filter((e) => e.timeMs !== null).length
  const expected = teamSize ? teamSize * 2 : Math.max(0, ...block.rounds.map(finished))
  const picked = new Map<string, string>()
  block.rounds.forEach((round, i) => {
    const count = finished(round)
    if (count >= expected) return
    if (i === 0) picked.set(round.key, `first round, only ${count} of ${expected} drivers`)
    else if (count < expected / 2) picked.set(round.key, `only ${count} of ${expected} drivers`)
  })
  return picked
}

export interface PlannedResult {
  tmId: string
  name: string
  timeMs: number | null
  dnf: boolean
  isOurTeam: boolean
}

export interface PlannedRound {
  key: string
  number: number
  time: number
  // In finishing order, drivers who did not finish last
  results: PlannedResult[]
  // Names of the drivers added because the file has no row for them
  dnfs: string[]
}

export interface PlannedBlock {
  rounds: PlannedRound[]
  ours: BlockDriver[]
  theirs: BlockDriver[]
  warnings: string[]
}

// What would be saved for a block: its selected rounds with every driver on a side. Whoever
// drove in the block but is missing in a round did not finish it and is added on the last
// place. That only works while a side has no more drivers than the format allows; after a
// substitution nobody can tell who was missing, so nothing is added for that side.
export function planBlock(block: CsvBlock, selected: Set<string>, ourTmIds: Set<string>, teamSize: number | null): PlannedBlock {
  const drivers = blockDrivers(block, selected)
  const ours = drivers.filter((d) => ourTmIds.has(d.tmId))
  const theirs = drivers.filter((d) => !ourTmIds.has(d.tmId))

  const warnings: string[] = []
  if (teamSize) {
    if (ours.length !== teamSize) warnings.push(`Us: ${ours.length} drivers instead of ${teamSize}`)
    if (theirs.length !== teamSize) warnings.push(`Opponent: ${theirs.length} drivers instead of ${teamSize}`)
  } else if (ours.length !== theirs.length) {
    warnings.push(`Uneven sides: us ${ours.length}, opponent ${theirs.length}`)
  }
  const complete = (side: BlockDriver[]) => (teamSize ? side.length <= teamSize : true)
  const fillable = [...(complete(ours) ? ours : []), ...(complete(theirs) ? theirs : [])]

  const rounds = block.rounds
    .filter((round) => selected.has(round.key))
    .map((round) => {
      const missing = fillable.filter((d) => !round.entries.some((e) => e.tmId === d.tmId))
      const entries = [...round.entries, ...missing.map((d) => ({ tmId: d.tmId, name: d.name, timeMs: null }))]
      return {
        key: round.key,
        number: round.number,
        time: round.time,
        results: entries.map((e) => ({ ...e, dnf: e.timeMs === null, isOurTeam: ourTmIds.has(e.tmId) })),
        dnfs: missing.map((d) => d.name),
      }
    })
  return { rounds, ours, theirs, warnings }
}
