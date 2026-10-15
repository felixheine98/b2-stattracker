import type { Answer } from "./planning"

export type ImportAnswer = "FIX" | "MAYBE" | "OUT" | `level:${string}`
export interface ReactionSnapshot {
  messageUrl: string
  fetchedAt: string
  users: Array<{ id: string; name: string }>
  reactions: Array<{ key: string; label: string; imageUrl?: string; userIds: string[] }>
}
export interface ReactionPreviewRow {
  playerId: string
  before: Answer
  after: ImportAnswer | null
  candidates: ImportAnswer[]
  kind: "change" | "unchanged" | "conflict" | "skipped" | "no-answer"
}

export function validateReactionMapping(
  snapshot: ReactionSnapshot, mapping: Record<string, ImportAnswer | "">, identities: Record<string, string>,
  playerIds: string[], levelIds: string[],
) {
  const valid = new Set(["FIX", "MAYBE", "OUT", "", ...levelIds.map(id => `level:${id}`)])
  const relevantUsers = new Set<string>()
  for (const reaction of snapshot.reactions) {
    if (!Object.hasOwn(mapping, reaction.key)) throw new Error("Choose a status or Ignore for every emoji.")
    if (!valid.has(mapping[reaction.key])) throw new Error("A selected planning level no longer exists. Fetch again.")
    if (mapping[reaction.key]) reaction.userIds.forEach(id => relevantUsers.add(id))
  }
  for (const id of relevantUsers) {
    if (!Object.hasOwn(identities, id)) throw new Error("Assign or ignore every Discord account with a relevant reaction.")
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

// No reaction, an ignored emoji or an explicit skip never clears a planning answer.
export function reactionPreview(
  snapshot: ReactionSnapshot,
  emojiMapping: Record<string, ImportAnswer | "">,
  identities: Record<string, string>,
  players: Array<{ playerId: string; answer: Answer }>,
  resolutions: Record<string, ImportAnswer | "">,
): ReactionPreviewRow[] {
  return players.map(({ playerId, answer: before }) => {
    const userIds = new Set(Object.entries(identities).filter(([, id]) => id === playerId).map(([id]) => id))
    const candidates = [...new Set(snapshot.reactions
      .filter((r) => r.userIds.some((id) => userIds.has(id)))
      .map((r) => emojiMapping[r.key]).filter((a): a is ImportAnswer => !!a))]
    const choice = resolutions[playerId]
    if (choice === "") return { playerId, before, after: null, candidates, kind: "skipped" }
    const after = choice && candidates.includes(choice) ? choice : candidates.length === 1 ? candidates[0] : null
    return { playerId, before, after, candidates, kind: after ? (after === before ? "unchanged" : "change") : candidates.length > 1 ? "conflict" : "no-answer" }
  })
}
