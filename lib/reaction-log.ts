// The messages the Discord bot keeps reaction times for, as the page for managers lists them.
export interface TrackedMessage {
  messageId: string
  channelId: string | null
  since: string
  reactions: number
  lastAt: string | null
}

export interface TrackedRow extends TrackedMessage {
  // The Discord message, if the channel is known
  link: string | null
  // The comp whose announcement it is; the others are candidates for removing
  usedBy: string | null
}

// Latest activity first; messages nobody reacted to since come last
export function describeTracked(guildId: string, tracked: TrackedMessage[], plannings: Array<{ name: string; messageUrl: string }>): TrackedRow[] {
  const announcements = new Map(plannings.flatMap(p => {
    const id = p.messageUrl.match(/\/channels\/\d+\/\d+\/(\d+)$/)?.[1]
    return id ? [[id, p.name] as const] : []
  }))
  return tracked
    .map(t => ({
      ...t,
      link: t.channelId ? `https://discord.com/channels/${guildId}/${t.channelId}/${t.messageId}` : null,
      usedBy: announcements.get(t.messageId) ?? null,
    }))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""))
}
