import { db } from "@/lib/db"
import { fetchTrackedMessages, removeTrackedMessage } from "@/lib/discord-bot"
import { removeExpiredMessages, type TrackedClaim } from "@/lib/reaction-log"

// The comps and the announcement each has saved, and the lineups with their channel, whose marked
// matchday pings are all kept (docs/adr/008)
export const plannedAnnouncements = async (): Promise<TrackedClaim[]> => {
  const [plannings, lineups] = await Promise.all([
    db.planning.findMany({ select: { discordSettings: true, tournament: { select: { name: true } } } }),
    db.tournamentLineup.findMany({ where: { discordChannelId: { not: null } }, select: { name: true, discordChannelId: true, tournament: { select: { name: true } } } }),
  ])
  return [
    ...plannings.map(p => ({ name: p.tournament.name, messageUrl: (p.discordSettings as { messageUrl?: string } | null)?.messageUrl ?? "" })),
    ...lineups.map(l => ({ name: `${l.tournament.name} · ${l.name} (lineup channel)`, channelId: l.discordChannelId! })),
  ]
}

// Makes the bot forget the tracked messages no comp has claimed for a week
export const sweepUnusedMessages = () =>
  removeExpiredMessages({ list: () => fetchTrackedMessages(), plannings: plannedAnnouncements, remove: id => removeTrackedMessage(id) })
