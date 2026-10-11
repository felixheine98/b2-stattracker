import { load } from "cheerio"
import { opponentNameKey } from "./opponents"

export const TEAM_SHEET_ID = "1VRB3b8dS38T8CadWAu-SZj8A5BK7eEwA3jFb-O0Aufo"
export const TEAM_SHEET_GID = "492976099"
export const TEAM_SHEET_URL = `https://docs.google.com/spreadsheets/d/${TEAM_SHEET_ID}/htmlview/sheet?headers=true&gid=${TEAM_SHEET_GID}`
export interface SheetMember { name: string; country: string | null }
export interface SheetBlock { key: string; name: string; logoUrl: string | null; members: SheetMember[]; row: number; column: number }
export interface SheetSource {
  blocks?: Array<{ key?: string; name: string; members?: SheetMember[] }>
  selection?: Array<{ blockName: string; name: string }>
}
export function sourcePreviewExclusions(blocks: SheetBlock[], previous: SheetSource | null): string[] {
  if (!previous?.selection) return []
  return blocks.flatMap(block => {
    const old = previous.blocks?.filter(b => opponentNameKey(b.name) === opponentNameKey(block.name)) ?? []
    if (old.length !== 1) return []
    return block.members.filter(m => old[0].members?.some(p => opponentNameKey(p.name) === opponentNameKey(m.name)) && !previous.selection!.some(p => opponentNameKey(p.blockName) === opponentNameKey(block.name) && opponentNameKey(p.name) === opponentNameKey(m.name))).map(m => `${block.key}:${m.name}`)
  })
}
interface Cell { text: string; image: string | null; anchor: boolean; colspan: number; rowspan: number }

// Restore the real grid, including both kinds of merged cells. Neighboring blocks
// are independent sources; never infer an organisation from their position.
export function parseTeamSheet(html: string): SheetBlock[] {
  const $ = load(html)
  $("br").replaceWith(" ")
  const table = $("table.waffle").first()
  if (!table.length) throw new Error("The team list has an unknown layout or is not publicly reachable.")
  const grid: Cell[][] = []
  table.find("tr").each((_, tr) => {
    const cells = $(tr).children("td")
    if (!cells.length) return
    const number = Number($(tr).children("th").first().text())
    const row = number > 0 ? number - 1 : grid.length
    grid[row] ??= []
    let col = 0
    cells.each((_, td) => {
      while (grid[row][col]) col++
      const el = $(td), colspan = Math.max(1, Number(el.attr("colspan")) || 1), rowspan = Math.max(1, Number(el.attr("rowspan")) || 1)
      const cell: Cell = { text: el.text().replace(/\s+/g, " ").trim(), image: el.find("img").first().attr("src") ?? null, colspan, rowspan, anchor: true }
      for (let y = row; y < row + rowspan; y++) {
        grid[y] ??= []
        for (let x = col; x < col + colspan; x++) grid[y][x] = { ...cell, anchor: y === row && x === col }
      }
      col += colspan
    })
  })
  const blocks: SheetBlock[] = [], active = new Map<number, SheetBlock>(), pending = new Map<number, string>()
  for (let row = 0; row < grid.length; row++) {
    const cells = grid[row] ?? []
    for (let start = 0; start < cells.length; start += 4) {
      const country = cells[start]?.text ?? "", flag = cells[start + 1], name = cells[start + 2]
      const merged = cells[start]?.colspan >= 3 ? cells[start] : null
      if (merged?.anchor && merged.image) { pending.set(start, merged.image); active.delete(start) }
      const header = merged?.anchor && merged.text ? merged : name?.anchor && name.rowspan > 1 ? name : null
      if (header && !/^[A-Z]{2}$/.test(country)) {
        const block = { key: `${TEAM_SHEET_GID}:${row + 1}:${start}`, name: header.text, logoUrl: flag?.image ?? pending.get(start) ?? null, members: [], row: row + 1, column: start }
        if (block.name) { blocks.push(block); active.set(start, block); pending.delete(start) }
      } else if (/^[A-Z]{2}$/.test(country) && name?.anchor && name.text) {
        const block = active.get(start)
        if (block && !block.members.some(m => opponentNameKey(m.name) === opponentNameKey(name.text))) block.members.push({ name: name.text, country: country.toLowerCase() })
      }
    }
  }
  if (!blocks.length) throw new Error("No team blocks were recognised in the team list.")
  return blocks
}
export function findSheetBlock(blocks: SheetBlock[], name: string): SheetBlock | null {
  const found = blocks.filter(b => opponentNameKey(b.name) === opponentNameKey(name))
  return found.length === 1 ? found[0] : null
}
