// The search over everything that has a page of its own: our players, opponent teams, their
// lineups and players, tournaments and matches. The whole index is small, so it is loaded
// once (lib/search-db.ts) and searched in the browser.

export type SearchKind = "player" | "team" | "lineup" | "opponentPlayer" | "tournament" | "match"

export interface SearchEntry {
  kind: SearchKind
  id: string
  title: string
  // Shown next to the title, e.g. the tournament of a lineup
  detail?: string
  href: string
  // Other names it is found under: former names, aliases
  aliases?: string[]
  // Set for matches, which have no name: what they are found by instead (opponent, lineup, tournament)
  terms?: string[]
  // Entries that are out of use come last in their group
  marker?: "archiviert" | "unbestätigt"
  // Day as YYYY-MM-DD; matches are listed newest first
  date?: string | null
}

export interface SearchHit {
  entry: SearchEntry
  // The former name or alias that matched, when the title itself did not
  via?: string
}

export interface SearchGroup {
  kind: SearchKind
  hits: SearchHit[]
  // Number of hits before the limit
  total: number
}

export const SEARCH_KINDS: SearchKind[] = ["player", "team", "lineup", "opponentPlayer", "tournament", "match"]

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean)

// Every word of the query has to be part of the text
const contains = (text: string, query: string[]) => {
  const lower = text.toLowerCase()
  return query.every((word) => lower.includes(word))
}

// Smaller is better; null for no hit
function rank(entry: SearchEntry, query: string[]): { rank: number; via?: string } | null {
  if (entry.terms) {
    const terms = entry.terms.map((t) => t.toLowerCase())
    return query.every((word) => terms.some((t) => t.includes(word))) ? { rank: 0 } : null
  }
  if (contains(entry.title, query)) return { rank: entry.title.toLowerCase().startsWith(query[0]) ? 0 : 1 }
  const via = entry.aliases?.find((alias) => contains(alias, query))
  return via ? { rank: 2, via } : null
}

export function search(entries: SearchEntry[], text: string, limit = 6): SearchGroup[] {
  const query = words(text)
  if (query.length === 0) return []

  return SEARCH_KINDS.flatMap((kind) => {
    const hits = entries
      .filter((e) => e.kind === kind)
      .flatMap((entry) => {
        const found = rank(entry, query)
        return found ? [{ entry, ...found }] : []
      })
      .sort(
        (a, b) =>
          Number(!!a.entry.marker) - Number(!!b.entry.marker) ||
          a.rank - b.rank ||
          (kind === "match" ? (b.entry.date ?? "").localeCompare(a.entry.date ?? "") : 0) ||
          a.entry.title.localeCompare(b.entry.title)
      )
      .map(({ entry, via }) => ({ entry, ...(via && { via }) }))
    return hits.length > 0 ? [{ kind, hits: hits.slice(0, limit), total: hits.length }] : []
  })
}
