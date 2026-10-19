export interface DiscordMember {
  id: string
  name: string
  username: string
  directoryName?: string
  roles: string[]
}

// A suggestion only preselects a player; nothing is linked until a manager confirms it.
export function suggestPlayer(
  member: Pick<DiscordMember, "name" | "username" | "directoryName">,
  players: Array<{ id: string; names: string[]; linked: boolean }>,
): string | null {
  const wanted = new Set([member.name, member.username, member.directoryName].filter((n): n is string => !!n).map(n => n.toLowerCase()))
  const matches = players.filter(p => p.names.some(n => wanted.has(n.toLowerCase())))
  return matches.length === 1 && !matches[0].linked ? matches[0].id : null
}
