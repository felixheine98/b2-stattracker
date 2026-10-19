import { db } from "@/lib/db"
import { fetchTrackedMessages, removeTrackedMessage } from "@/lib/discord-bot"
import { removeExpiredMessages } from "@/lib/reaction-log"

// The comps and the announcement each has saved
export const plannedAnnouncements = async () =>
  (await db.planning.findMany({ select: { discordSettings: true, tournament: { select: { name: true } } } }))
    .map(p => ({ name: p.tournament.name, messageUrl: (p.discordSettings as { messageUrl?: string } | null)?.messageUrl ?? "" }))

// Makes the bot forget the tracked messages no comp has claimed for a week
export const sweepUnusedMessages = () =>
  removeExpiredMessages({ list: () => fetchTrackedMessages(), plannings: plannedAnnouncements, remove: id => removeTrackedMessage(id) })
