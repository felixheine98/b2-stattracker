// Players whose name contains the text: those starting with it first, each group in alphabetical order
export function searchPlayers<T extends { name: string }>(players: T[], query: string): T[] {
  const text = query.trim().toLowerCase()
  if (!text) return []
  const rank = (p: T) => (p.name.toLowerCase().startsWith(text) ? 0 : 1)
  return players
    .filter((p) => p.name.toLowerCase().includes(text))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
