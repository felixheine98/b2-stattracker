import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { db } from "@/lib/db"
import { fetchTrackedMessages, removeTrackedMessage } from "@/lib/discord-bot"
import { loadPlanning } from "@/lib/planning-db"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({ messageIds: z.array(z.string().regex(/^\d{1,20}$/)).min(1).max(1000) })

// The bot stops keeping reaction times for these messages; the messages on Discord stay as they are
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Send a list of message IDs." }, { status: 400 })
  try {
    for (const id of parsed.data.messageIds) await removeTrackedMessage(id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The bot could not remove the messages." }, { status: 502 })
  }
  return NextResponse.json({ removed: parsed.data.messageIds.length })
}

const assignment = z.object({ messageId: z.string().regex(/^\d{1,20}$/), tournamentId: z.string().min(1).max(100), replace: z.boolean().optional() })

// Makes the message the announcement of a comp, as pasting its link into the comp's planning would.
// The link is built from what the bot knows, never taken from the browser.
export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = assignment.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose a message and a comp." }, { status: 400 })
  const { messageId, tournamentId, replace } = parsed.data

  const loaded = await loadPlanning(tournamentId)
  if (!loaded) return NextResponse.json({ error: "This comp has no planning." }, { status: 404 })
  if (loaded.archived) return NextResponse.json({ error: "The planning is closed: the tournament has its lineups." }, { status: 409 })

  let tracked
  try { tracked = await fetchTrackedMessages() } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The bot could not list the tracked messages." }, { status: 502 })
  }
  const message = tracked.messages.find(m => m.messageId === messageId)
  if (!message) return NextResponse.json({ error: "The bot does not keep this message any more." }, { status: 404 })
  if (!message.channelId) return NextResponse.json({ error: "The bot does not know the channel of this message yet. It learns it from the next reaction." }, { status: 400 })

  const messageUrl = `https://discord.com/channels/${tracked.guildId}/${message.channelId}/${messageId}`
  const settings = (loaded.planning.discordSettings ?? {}) as { messageUrl?: string; emojiMapping?: Record<string, string> }
  if (settings.messageUrl && settings.messageUrl !== messageUrl && !replace) {
    return NextResponse.json({ error: "This comp already uses another message.", replaces: true }, { status: 409 })
  }
  // Like the link saved on fetch: no new revision, so an open preview stays valid
  await db.planning.update({ where: { id: loaded.planning.id }, data: { discordSettings: { emojiMapping: {}, ...settings, messageUrl } } })
  return NextResponse.json({ messageUrl })
}
