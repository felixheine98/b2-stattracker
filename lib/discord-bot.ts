import { z } from "zod"
import { createHmac, timingSafeEqual } from "node:crypto"
import type { ReactionSnapshot } from "./discord-planning"
import type { TrackedMessage } from "./reaction-log"
import type { ServerRole } from "./discord-mentions"
import type { ServerEmoji } from "./matchday-discord"

export const reactionSnapshotSchema = z.object({
  messageUrl: z.string(), fetchedAt: z.string().datetime(),
  // Since when the bot has been writing down the moment reactions come in; missing if it has not been asked about this message yet
  trackedSince: z.string().datetime().optional(),
  users: z.array(z.object({ id: z.string(), name: z.string().max(200) })).max(10000),
  reactions: z.array(z.object({ key: z.string().max(200), label: z.string().max(200), imageUrl: z.string().optional(), userIds: z.array(z.string()).max(10000),
    // When the bot saw each user react; users who reacted before it started tracking have no entry
    reactedAt: z.record(z.string(), z.string().datetime()).optional() })).max(100),
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

type BotConfig = { url: string | undefined; token: string | undefined }
const botConfig = (): BotConfig => ({ url: process.env.DISCORD_BOT_URL, token: process.env.DISCORD_BOT_API_TOKEN })

const trackedSchema = z.object({ guildId: z.string(), messages: z.array(z.object({
  messageId: z.string(), channelId: z.string().nullable(), since: z.string(), trackedAt: z.string(), reactions: z.number().int(), lastAt: z.string().nullable(),
  // What the message is, read from Discord; missing when the bot was not asked, null when Discord no longer has it
  preview: z.object({
    channelName: z.string().nullable(), author: z.string().nullable(), postedAt: z.string(),
    text: z.string().max(1000), attachments: z.number().int(),
  }).nullable().optional(),
})).max(100000) })

// The messages the bot writes reaction times down for
export async function fetchTrackedMessages(config: BotConfig = botConfig()): Promise<{ guildId: string; messages: TrackedMessage[] }> {
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  const response = await fetch(new URL("/tracked", config.url), { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error" })
  if (!response.ok) throw new Error("The bot could not list the tracked messages.")
  return trackedSchema.parse(await response.json())
}

// The bot stops writing down the reactions of a message; one that is already gone is as good as removed
export async function removeTrackedMessage(messageId: string, config: BotConfig = botConfig()) {
  if (!/^\d{1,20}$/.test(messageId)) throw new Error("Invalid message ID.")
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  const response = await fetch(new URL(`/tracked/${messageId}`, config.url), { method: "DELETE", headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error" })
  if (!response.ok && response.status !== 404) throw new Error("The bot could not remove the message.")
}

const announcementsSchema = z.object({ announcements: z.array(z.object({
  messageUrl: z.string(), messageId: z.string(), channelId: z.string(), postedAt: z.string().datetime(),
  author: z.string().max(200).nullable(), text: z.string().max(1000),
})).max(100) })

export type BotAnnouncement = z.infer<typeof announcementsSchema>["announcements"][number]

// The pings in a lineup channel that mark the bot, newest first (docs/adr/008)
export async function fetchAnnouncements(channelId: string, config: BotConfig = botConfig()): Promise<BotAnnouncement[]> {
  if (!/^\d{1,20}$/.test(channelId)) throw new Error("Invalid channel.")
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  const url = new URL("/announcements", config.url)
  url.search = new URLSearchParams({ channelId }).toString()
  const response = await fetch(url, { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error" })
  if (!response.ok) throw new Error("The bot could not read the lineup channel. Check the link and its channel permissions.")
  const { announcements } = announcementsSchema.parse(await response.json())
  if (announcements.some(a => a.channelId !== channelId)) throw new Error("The bot returned messages of a different channel.")
  return announcements
}

// The bot posts the matchday announcement in the lineup channel and sets the emojis under it
export async function postAnnouncement(channelId: string, text: string, emojis: string[], config: BotConfig = botConfig()): Promise<BotAnnouncement> {
  if (!/^\d{1,20}$/.test(channelId)) throw new Error("Invalid channel.")
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  const response = await fetch(new URL("/announcements", config.url), {
    method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channelId, text, emojis }), cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error",
  })
  if (!response.ok) throw new Error("The bot could not post in the lineup channel. Check its permission to send messages and add reactions there.")
  const posted = announcementsSchema.shape.announcements.element.parse(await response.json())
  if (posted.channelId !== channelId) throw new Error("The bot posted in a different channel.")
  return posted
}

const serverEmojisSchema = z.object({ emojis: z.array(z.object({
  key: z.string().regex(/^custom:\d{1,20}$/), name: z.string().max(100), text: z.string().max(150), imageUrl: z.string().url(),
})).max(5000) })

// The server's own emojis, to choose the reactions of an announcement from
const serverRolesSchema = z.object({
  roles: z.array(z.object({ id: z.string().regex(/^\d{1,20}$/), name: z.string().max(100), mentionable: z.boolean(), color: z.string().max(20).nullable() })).max(1000),
  mentionAll: z.boolean(),
})

// The server's roles to mention, and whether the bot may ping the ones not mentionable in the channel
export async function fetchServerRoles(channelId: string, config: BotConfig = botConfig()): Promise<{ roles: ServerRole[]; mentionAll: boolean }> {
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  if (!/^\d{1,20}$/.test(channelId)) throw new Error("Invalid channel.")
  const url = new URL("/roles", config.url)
  url.searchParams.set("channelId", channelId)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error" })
  if (!response.ok) throw new Error("The bot could not list the server roles.")
  return serverRolesSchema.parse(await response.json())
}

export async function fetchServerEmojis(config: BotConfig = botConfig()): Promise<ServerEmoji[]> {
  if (!config.url || !config.token) throw new Error("The Discord bot connection is not configured.")
  const response = await fetch(new URL("/emojis", config.url), { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(30000), redirect: "error" })
  if (!response.ok) throw new Error("The bot could not list the server emojis.")
  const { emojis } = serverEmojisSchema.parse(await response.json())
  if (emojis.some(e => e.text.match(/^<a?:\w{2,32}:(\d{1,20})>$/)?.[1] !== e.key.slice(7))) throw new Error("The bot returned an emoji that cannot be read.")
  return emojis
}
