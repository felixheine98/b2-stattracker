// Players whose name contains the text: those starting with it first, each group in alphabetical order.
// Names a player had before (allNames) and the nickname are searched as well.
export function searchPlayers<T extends { name: string; allNames?: string[]; nickname?: string | null }>(players: T[], query: string): T[] {
  const text = query.trim().toLowerCase()
  if (!text) return []
  const names = (p: T) => [p.name, ...(p.allNames ?? []), ...(p.nickname ? [p.nickname] : [])].map((n) => n.toLowerCase())
  const rank = (p: T) => (names(p).some((n) => n.startsWith(text)) ? 0 : 1)
  return players
    .filter((p) => names(p).some((n) => n.includes(text)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
