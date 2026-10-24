// Reading the master sheet of a seeding (docs/adr/010, question 14), as Google exports its tabs:
// "Seeding" holds per map a block with every team's players, their logins and points, and a
// ranking of all teams; "Leagues" places the teams in leagues and groups.

export interface SheetPlayer {
  name: string
  // Trackmania account ID; the sheet gives it as the login, base64url-encoded
  tmId: string
  // Points over the session; 0 where the player did not drive the map
  points: number
}

export interface SheetTeam {
  name: string
  // Its players per map, in the order of the sheet's maps
  maps: SheetPlayer[][]
  rank: number | null
  total: number | null
  // E.g. "League 4 · Group H"; null without the leagues tab or where the team is not placed
  league: string | null
}

export interface SeedingSheet {
  maps: string[]
  teams: SheetTeam[]
}

// Rows and cells of a CSV export, with quoted cells
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell); rows.push(row); row = []; cell = ""
    } else cell += c
  }
  if (cell || row.length > 0) { row.push(cell); rows.push(row) }
  return rows
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

// A Trackmania login (the account ID's 16 bytes in base64url) as the account ID
export function loginToTmId(login: string): string | null {
  const text = login.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return text.toLowerCase()
  if (!/^[A-Za-z0-9_-]{22}$/.test(text)) return null
  let bits = 0, value = 0
  const bytes: number[] = []
  for (const c of text) {
    value = (value << 6) | ALPHABET.indexOf(c)
    bits += 6
    if (bits >= 8) { bits -= 8; bytes.push((value >> bits) & 0xff) }
  }
  const hex = bytes.slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const number = (cell: string | undefined) => {
  const n = Number((cell ?? "").trim())
  return (cell ?? "").trim() !== "" && Number.isFinite(n) ? n : null
}

// Team name to "League N · Group X", by lower-cased name
function readLeagues(csv: string): Map<string, string> {
  const placed = new Map<string, string>()
  let leagues: Array<{ col: number; name: string }> = []
  let groups: Array<{ col: number; name: string }> = []
  for (const row of parseCsv(csv)) {
    const cells = row.map((c) => c.trim())
    if (cells.some((c) => /^League \d+/i.test(c))) {
      leagues = cells.flatMap((c, col) => (/^League \d+/i.test(c) ? [{ col, name: c }] : []))
      groups = []
    } else if (cells.some((c) => /^Group \S+/i.test(c))) {
      groups = cells.flatMap((c, col) => {
        if (!/^Group \S+/i.test(c)) return []
        const league = [...leagues].reverse().find((l) => l.col <= col)
        return [{ col, name: league ? `${league.name} · ${c}` : c }]
      })
    } else if (cells.every((c) => !c)) groups = []
    else for (const group of groups) if (cells[group.col]) placed.set(cells[group.col].toLowerCase(), group.name)
  }
  return placed
}

export function parseSeedingSheet(seedingCsv: string, leaguesCsv?: string): SeedingSheet {
  const rows = parseCsv(seedingCsv.replace(/^﻿/, ""))
  // Every map block starts with "Map N - Name" above its team column
  const blocks = (rows[0] ?? []).flatMap((c, col) => {
    const found = /^Map \d+\s*-\s*(.+)$/i.exec(c.trim())
    return found ? [{ col, name: found[1].trim() }] : []
  })
  const headerIndex = rows.findIndex((r) => r.some((c) => c.trim() === "Team"))
  const header = rows[headerIndex] ?? []
  const teamCols = blocks.map((b) => header.findIndex((c, col) => col >= b.col - 1 && c.trim() === "Team"))
  const rankCol = header.findIndex((c) => c.trim() === "Rank")
  const leagues = leaguesCsv ? readLeagues(leaguesCsv) : new Map<string, string>()

  const body = rows.slice(headerIndex + 1)
  const ranking = new Map<string, { rank: number | null; total: number | null }>()
  if (rankCol >= 0) for (const row of body) if (row[rankCol + 1]?.trim()) ranking.set(row[rankCol + 1].trim(), { rank: number(row[rankCol]), total: number(row[rankCol + 2]) })

  const teams = body.flatMap((row): SheetTeam[] => {
    const name = row[teamCols[0]]?.trim()
    if (!name) return []
    const maps = teamCols.map((teamCol) => {
      const players: SheetPlayer[] = []
      // After the team column, per player: name, login and points
      for (let col = teamCol + 1; /^Player \d+$/.test(header[col]?.trim() ?? ""); col += 3) {
        const playerName = row[col]?.trim()
        const tmId = loginToTmId(row[col + 1] ?? "")
        if (playerName && tmId) players.push({ name: playerName, tmId, points: number(row[col + 2]) ?? 0 })
      }
      return players
    })
    return [{ name, maps, ...(ranking.get(name) ?? { rank: null, total: null }), league: leagues.get(name.toLowerCase()) ?? null }]
  })
  return { maps: blocks.map((b) => b.name), teams }
}
