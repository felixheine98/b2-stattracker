// The messages the Discord bot keeps reaction times for, as the page for managers lists them.
export interface TrackedMessage {
  messageId: string
  channelId: string | null
  since: string
  // When the bot began to keep this message, which starts its week if no comp claims it
  trackedAt: string
  reactions: number
  lastAt: string | null
  preview?: {
    channelName: string | null
    author: string | null
    postedAt: string
    // Empty unless the bot may read message content
    text: string
    attachments: number
  } | null
}

export interface TrackedRow extends TrackedMessage {
  // The Discord message, if the channel is known
  link: string | null
  // The comp whose announcement it is; the others are candidates for removing
  usedBy: string | null
  // When the bot forgets the message by itself; null for one a comp uses
  expiresAt: string | null
}

// A message nobody assigned to a comp is forgotten a week after tracking began
export const UNUSED_KEEP_MS = 7 * 24 * 3600 * 1000

// What claims tracked messages: a comp by its announcement, or a lineup by its channel (every marked
// matchday ping in there, docs/adr/008); a message's own claim goes before its channel's
export type TrackedClaim = { name: string; messageUrl: string } | { name: string; channelId: string }

// Latest activity first; messages nobody reacted to since come last
export function describeTracked(guildId: string, tracked: TrackedMessage[], plannings: TrackedClaim[]): TrackedRow[] {
  const channels = new Map(plannings.flatMap(p => ("channelId" in p ? [[p.channelId, p.name] as const] : [])))
  const announcements = new Map(plannings.flatMap(p => {
    if (!("messageUrl" in p)) return []
    const id = p.messageUrl.match(/\/channels\/\d+\/\d+\/(\d+)$/)?.[1]
    return id ? [[id, p.name] as const] : []
  }))
  return tracked
    .map(t => ({
      ...t,
      link: t.channelId ? `https://discord.com/channels/${guildId}/${t.channelId}/${t.messageId}` : null,
      usedBy: announcements.get(t.messageId) ?? (t.channelId ? channels.get(t.channelId) : undefined) ?? null,
    }))
    .map(t => ({ ...t, expiresAt: t.usedBy ? null : new Date(new Date(t.trackedAt).getTime() + UNUSED_KEEP_MS).toISOString() }))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""))
}

// The unused messages whose week is over
export const expiredMessages = (rows: TrackedRow[], now: Date): string[] =>
  rows.filter(r => r.expiresAt && new Date(r.expiresAt) <= now).map(r => r.messageId)

// Asks the bot to forget the expired messages. Reading the comps first: if that fails, nothing is
// removed, so no message is taken for unused only because the announcements could not be looked up.
export async function removeExpiredMessages(deps: {
  list: () => Promise<{ guildId: string; messages: TrackedMessage[] }>
  plannings: () => Promise<TrackedClaim[]>
  remove: (messageId: string) => Promise<void>
  now?: () => Date
}): Promise<string[]> {
  const [tracked, plannings] = await Promise.all([deps.list(), deps.plannings()])
  const expired = expiredMessages(describeTracked(tracked.guildId, tracked.messages, plannings), (deps.now ?? (() => new Date()))())
  for (const id of expired) await deps.remove(id)
  return expired
}
