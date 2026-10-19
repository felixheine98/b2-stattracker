import { z } from "zod"
import { createHmac, timingSafeEqual } from "node:crypto"
import type { ReactionSnapshot } from "./discord-planning"

export const reactionSnapshotSchema = z.object({
  messageUrl: z.string(), fetchedAt: z.string().datetime(),
  users: z.array(z.object({ id: z.string(), name: z.string().max(200) })).max(10000),
  reactions: z.array(z.object({ key: z.string().max(200), label: z.string().max(200), imageUrl: z.string().optional(), userIds: z.array(z.string()).max(10000) })).max(100),
})

interface SignedPreview { snapshot: ReactionSnapshot; tournamentId: string; revision: number }

// The browser may map emojis, but cannot invent reactions or reuse a different comp's preview.
export function signReactionSnapshot(data: SignedPreview, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...data, expires: now + 15 * 60 * 1000 })).toString("base64url")
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyReactionSnapshot(token: string, secret: string, tournamentId: string, now = Date.now()): SignedPreview {
  const [payload, signature, extra] = token.split(".")
  const expected = createHmac("sha256", secret).update(payload ?? "").digest("base64url")
  if (extra || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid preview. Fetch the reactions again.")
  }
  const parsed = z.object({ snapshot: reactionSnapshotSchema, tournamentId: z.literal(tournamentId), revision: z.number().int().nonnegative(), expires: z.number().gt(now) })
    .safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")))
  if (!parsed.success) throw new Error("This preview has expired. Fetch the reactions again.")
  return parsed.data
}

export async function fetchReactions(link: string, config = { url: process.env.DISCORD_BOT_URL, token: process.env.DISCORD_BOT_API_TOKEN }) {
  const match = link.trim().match(/^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/)
  if (!match) throw new Error("Enter a valid Discord message link.")
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  const url = new URL("/reactions", config.url)
  url.search = new URLSearchParams({ guildId: match[1], channelId: match[2], messageId: match[3] }).toString()
  const response = await fetch(url, { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error" })
  if (!response.ok) throw new Error("The bot could not read that message. Check the link and its channel permissions.")
  const snapshot = reactionSnapshotSchema.parse(await response.json())
  if (snapshot.messageUrl !== `https://discord.com/channels/${match[1]}/${match[2]}/${match[3]}`) throw new Error("The bot returned reactions for a different message.")
  return snapshot
}

const memberListSchema = z.object({ members: z.array(z.object({
  id: z.string().regex(/^\d{1,20}$/), name: z.string().max(200), username: z.string().max(200),
  directoryName: z.string().max(200).optional(), roles: z.array(z.string().max(100)).max(10),
})).max(25000) })

// The bot only knows its own server, so the web app does not need its ID.
export async function fetchMembers(config = { url: process.env.DISCORD_BOT_URL, token: process.env.DISCORD_BOT_API_TOKEN }) {
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  const url = new URL("/members", config.url)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error" })
  if (!response.ok) throw new Error("The bot could not list the server members.")
  return memberListSchema.parse(await response.json()).members
}
