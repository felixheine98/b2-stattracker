// Player names over time. A player has an initial name "from the beginning" plus dated
// renames. Inside a tournament the name on the tournament's start day counts, so old
// tournaments keep showing the name a player had back then.
import { dayKey } from "./player-status"

export interface NameChange {
  id: string
  name: string
  effectiveFrom: Date | string
}

export interface PlayerNameInfo {
  initialName: string
  nameChanges: NameChange[]
}

export function sortedNameChanges(player: PlayerNameInfo): NameChange[] {
  return [...player.nameChanges].sort((a, b) => dayKey(a.effectiveFrom).localeCompare(dayKey(b.effectiveFrom)))
}

// A rename counts from its own day on, so a tournament starting that day uses the new name
export function nameAt(player: PlayerNameInfo, date: Date | string): string {
  const day = dayKey(date)
  let name = player.initialName
  for (const change of sortedNameChanges(player)) {
    if (dayKey(change.effectiveFrom) > day) break
    name = change.name
  }
  return name
}

// Renames cannot be dated in the future, so the latest one is the name right now
export function currentName(player: PlayerNameInfo): string {
  return sortedNameChanges(player).at(-1)?.name ?? player.initialName
}

// Every name the player ever had, oldest first
export function allNames(player: PlayerNameInfo): string[] {
  return [...new Set([player.initialName, ...sortedNameChanges(player).map((c) => c.name)])]
}

// The renames needed so that the player has the given name from that day on. Without a later
// rename this would also change today's name, so that one is kept with an entry from today on.
export function planNameFrom(
  player: PlayerNameInfo,
  name: string,
  day: string,
  today: string
): Array<{ name: string; effectiveFrom: string }> {
  if (nameAt(player, day) === name) return []
  const entries = [{ name, effectiveFrom: day }]
  const laterRename = player.nameChanges.some((c) => dayKey(c.effectiveFrom) > day)
  const current = currentName(player)
  if (!laterRename && day < today && current !== name) entries.push({ name: current, effectiveFrom: today })
  return entries
}

// Loaded tournament data with the names valid on the given day: players (objects with id, tmId
// and name) and results of our players (playerId and playerName) get that name, plus today's
// name as currentName. Everything else is passed through; the input is not modified.
export function applyCompNames<T>(data: T, players: Array<{ id: string } & PlayerNameInfo>, date: Date | string): T {
  const byId = new Map(players.map((p) => [p.id, p]))

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk)
    if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) out[key] = walk(v)

    const player = typeof out.id === "string" && typeof out.tmId === "string" && typeof out.name === "string" ? byId.get(out.id) : undefined
    if (player) {
      out.name = nameAt(player, date)
      out.currentName = currentName(player)
      out.allNames = allNames(player)
    }
    const resultOf = typeof out.playerId === "string" && typeof out.playerName === "string" ? byId.get(out.playerId) : undefined
    if (resultOf) {
      out.playerName = nameAt(resultOf, date)
      out.currentName = currentName(resultOf)
    }
    return out
  }

  return walk(data) as T
}
