// Roles and players to mention in an announcement the bot posts (docs/adr/008). The text shows
// them as @names; only when posting they become Discord's mentions, which ping.

export interface ServerRole {
  id: string
  name: string
  mentionable: boolean
  color: string | null
}

// A mention as the text shows it and as Discord needs it
export interface Mention {
  label: string
  raw: string
}

// Words that name nothing of a comp on their own
const COMMON = new Set(["esports", "league", "season", "cup", "the", "and"])

const words = (name: string) =>
  name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !COMMON.has(w))

// The roles sharing a word with the comp's name; those sharing one with the lineup's name first
export function compRoles(roles: ServerRole[], comp: string, lineup: string): ServerRole[] {
  const compWords = new Set(words(comp))
  const lineupWords = new Set(words(lineup))
  const scored = roles
    .map((role, i) => ({ role, i, own: words(role.name).filter((w) => lineupWords.has(w)).length, comp: words(role.name).some((w) => compWords.has(w)) }))
    .filter((r) => r.comp)
  return scored.sort((a, b) => b.own - a.own || a.i - b.i).map((r) => r.role)
}

export function searchRoles(query: string, roles: ServerRole[]): ServerRole[] {
  const q = query.trim().toLowerCase()
  return q ? roles.filter((r) => r.name.toLowerCase().includes(q)) : roles
}

export const roleMention = (role: { id: string; name: string }): Mention => ({ label: `@${role.name}`, raw: `<@&${role.id}>` })
export const playerMention = (name: string, discordUserId: string): Mention => ({ label: `@${name}`, raw: `<@${discordUserId}>` })

// The @names inserted as mentions become Discord's form; the longest name wins where one starts another
export function toDiscordMentions(text: string, mentions: Mention[]): string {
  const raw = new Map(mentions.map((m) => [m.label, m.raw]))
  if (raw.size === 0) return text
  const labels = [...raw.keys()].sort((a, b) => b.length - a.length).map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${labels.join("|")})(?![\\p{L}\\p{N}_])`, "gu")
  return text.replace(pattern, (_, before: string, label: string) => before + raw.get(label))
}
