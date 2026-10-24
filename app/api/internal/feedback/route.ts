import { db } from "@/lib/db"
import { discordId, feedbackSubmission, validFeedbackToken } from "@/lib/feedback"
import { z } from "zod"

function authorize(req: Request) {
  if (process.env.APP_FEEDBACK !== "on") return Response.json({ error: "Not found" }, { status: 404 })
  if (!validFeedbackToken(req.headers.get("authorization"), process.env.DISCORD_BOT_API_TOKEN)) return Response.json({ error: "Unauthorized" }, { status: 401 })
}

async function allowedChannel(guildId: string, channelId: string) {
  const panel = await db.feedbackPanel.findUnique({ where: { id: "discord" } })
  return panel?.guildId === guildId && panel.channelId === channelId
}

export async function POST(req: Request) {
  const denied = authorize(req)
  if (denied) return denied
  const parsed = feedbackSubmission.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid feedback" }, { status: 400 })
  if (!await allowedChannel(parsed.data.guildId, parsed.data.channelId)) return Response.json({ error: "Wrong feedback channel" }, { status: 403 })
  // Discord deliveries may be repeated; acknowledge the same submission without creating another entry.
  const item = await db.appFeedback.upsert({ where: { interactionId: parsed.data.interactionId }, create: parsed.data, update: {} })
  return Response.json({ id: item.id })
}

export async function GET(req: Request) {
  const denied = authorize(req)
  if (denied) return denied
  const query = z.object({ guildId: discordId, channelId: discordId, authorId: discordId, cursor: z.string().min(1).max(100).optional() })
    .safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!query.success) return Response.json({ error: "Invalid request" }, { status: 400 })
  const { guildId, channelId, authorId, cursor } = query.data
  if (!await allowedChannel(guildId, channelId)) return Response.json({ error: "Wrong feedback channel" }, { status: 403 })
  const items = await db.appFeedback.findMany({
    where: { guildId, authorId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 6,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, title: true, text: true, category: true, status: true, createdAt: true },
  })
  return Response.json({ items: items.slice(0, 5), nextCursor: items.length > 5 ? items[4].id : null })
}
