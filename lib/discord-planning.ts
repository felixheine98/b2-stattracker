import type { Answer } from "./planning"

export type ImportAnswer = "FIX" | "MAYBE" | "OUT" | `level:${string}`
export interface ReactionSnapshot {
  messageUrl: string
  fetchedAt: string
  trackedSince?: string
  users: Array<{ id: string; name: string }>
  reactions: Array<{ key: string; label: string; imageUrl?: string; userIds: string[]; reactedAt?: Record<string, string> }>
}
// `A` is what a reaction can mean, `B` the answer a player has before; the comp planning's by default,
// the matchday planning's (lib/matchday-discord.ts) otherwise
export interface ReactionPreviewRow<A extends string = ImportAnswer, B = Answer> {
  playerId: string
  before: B
  after: A | null
  candidates: A[]
  // When the answer was given on Discord, per status: the latest reaction for it. Missing for
  // reactions the bot did not see come in.
  times: Partial<Record<A, string>>
  kind: "change" | "unchanged" | "conflict" | "skipped" | "no-answer"
}

export function validateReactionMapping(
  snapshot: ReactionSnapshot, mapping: Record<string, ImportAnswer | "">, identities: Record<string, string>,
  playerIds: string[], levelIds: string[],
) {
  const valid = new Set(["FIX", "MAYBE", "OUT", "", ...levelIds.map(id => `level:${id}`)])
  for (const reaction of snapshot.reactions) {
    if (!Object.hasOwn(mapping, reaction.key)) throw new Error("Choose a status or Ignore for every emoji.")
    if (!valid.has(mapping[reaction.key])) throw new Error("A selected planning level no longer exists. Fetch again.")
  }
  const assigned = new Set<string>()
  const users = new Set(snapshot.users.map(u => u.id))
  for (const [userId, playerId] of Object.entries(identities)) {
    if (!users.has(userId)) throw new Error("Unknown Discord account.")
    if (!playerId) continue
    if (!playerIds.includes(playerId)) throw new Error("Choose a player on this planning list.")
    if (assigned.has(playerId)) throw new Error("Two Discord accounts cannot be assigned to the same player.")
    assigned.add(playerId)
  }
}

// Accounts the import still asks about: a relevant reaction, but no link and not marked as not a player.
// Accounts linked to a player outside this planning are known and never asked about.
export function unknownAccounts(
  snapshot: ReactionSnapshot, emojiMapping: Record<string, string>,
  links: Record<string, string>, notAPlayer: string[],
) {
  const relevant = new Set(snapshot.reactions.filter(r => emojiMapping[r.key]).flatMap(r => r.userIds))
  const known = new Set([...Object.keys(links), ...notAPlayer])
  return snapshot.users.filter(u => relevant.has(u.id) && !known.has(u.id))
}

// A player has one Discord account: a link chosen in the import replaces the player's saved one.
export function importIdentities(saved: Record<string, string>, chosen: Record<string, string>) {
  const replaced = new Set(Object.values(chosen))
  return { ...Object.fromEntries(Object.entries(saved).filter(([, playerId]) => !replaced.has(playerId))), ...chosen }
}

export function previewSummary(rows: Array<ReactionPreviewRow<string, unknown>>) {
  const count = (kinds: ReactionPreviewRow<string, unknown>["kind"][]) => rows.filter(r => kinds.includes(r.kind)).length
  return { changes: count(["change"]), conflicts: count(["conflict"]), unchanged: count(["unchanged"]), withoutReaction: rows.filter(r => r.kind === "no-answer" && r.candidates.length === 0).length }
}

// No reaction, an ignored emoji or an explicit skip never clears a planning answer.
export function reactionPreview<A extends string = ImportAnswer, B = Answer>(
  snapshot: ReactionSnapshot,
  emojiMapping: Record<string, A | "">,
  identities: Record<string, string>,
  players: Array<{ playerId: string; answer: B }>,
  resolutions: Record<string, A | "">,
): Array<ReactionPreviewRow<A, B>> {
  return players.map(({ playerId, answer: before }) => {
    const userIds = new Set(Object.entries(identities).filter(([, id]) => id === playerId).map(([id]) => id))
    const candidates = [...new Set(snapshot.reactions
      .filter((r) => r.userIds.some((id) => userIds.has(id)))
      .map((r) => emojiMapping[r.key]).filter((a): a is A => !!a))]
    const times: ReactionPreviewRow<A, B>["times"] = {}
    for (const reaction of snapshot.reactions) {
      const answer = emojiMapping[reaction.key]
      if (!answer) continue
      for (const id of userIds) {
        const time = reaction.reactedAt?.[id]
        if (time && (!times[answer] || new Date(time) > new Date(times[answer]!))) times[answer] = time
      }
    }
    const choice = resolutions[playerId]
    if (choice === "") return { playerId, before, after: null, candidates, times, kind: "skipped" }
    const after = choice && candidates.includes(choice) ? choice : candidates.length === 1 ? candidates[0] : null
    return { playerId, before, after, candidates, times, kind: after ? ((after as unknown) === before ? "unchanged" : "change") : candidates.length > 1 ? "conflict" : "no-answer" }
  })
}

const berlin = { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const
const timeFormat = new Intl.DateTimeFormat("de-DE", { ...berlin, year: "numeric" })
const shortTimeFormat = new Intl.DateTimeFormat("de-DE", berlin)

// A moment from Discord (the last fetch, a reaction), in German local time
export const formatTime = (iso: string): string => timeFormat.format(new Date(iso))
export const formatTimeShort = (iso: string): string => shortTimeFormat.format(new Date(iso))
