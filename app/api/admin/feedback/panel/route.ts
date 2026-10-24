import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { discordId } from "@/lib/feedback"
import { z } from "zod"

export async function POST(req: Request) {
  if (process.env.APP_FEEDBACK !== "on") return Response.json({ error: "Not found" }, { status: 404 })
  const session = await auth()
  if (session?.user?.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = z.object({ channelId: discordId }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Enter a Discord channel ID." }, { status: 400 })
  if (!process.env.DISCORD_BOT_URL || !process.env.DISCORD_BOT_API_TOKEN) return Response.json({ error: "Discord bot is not configured." }, { status: 503 })
  const previous = await db.feedbackPanel.findUnique({ where: { id: "discord" } })
  // Reuse the existing message on retries; a different channel requires removing the old panel first.
  if (previous && previous.channelId !== parsed.data.channelId) return Response.json({ error: "A feedback channel is already configured. Keep this channel for the existing feedback panel." }, { status: 409 })
  try {
    const response = await fetch(new URL("/feedback/panel", process.env.DISCORD_BOT_URL), {
      method: "POST", headers: { Authorization: `Bearer ${process.env.DISCORD_BOT_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: parsed.data.channelId, messageId: previous?.messageId }),
      signal: AbortSignal.timeout(15000), redirect: "error",
    })
    if (!response.ok) throw new Error("Could not set up feedback")
    const panel = z.object({ guildId: discordId, channelId: discordId, messageId: discordId }).parse(await response.json())
    if (panel.channelId !== parsed.data.channelId) throw new Error("Wrong channel")
    await db.feedbackPanel.upsert({ where: { id: "discord" }, create: { id: "discord", ...panel }, update: panel })
    return Response.json(panel)
  } catch {
    return Response.json({ error: "Could not set up the feedback message. Check that feedback is enabled on the bot and it can view the channel, read message history and send messages." }, { status: 502 })
  }
}
