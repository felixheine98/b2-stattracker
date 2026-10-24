import { createHash, timingSafeEqual } from "node:crypto"
import { z } from "zod"

export const discordId = z.string().regex(/^\d{1,20}$/)
export const feedbackStatus = z.enum(["OPEN", "IN_PROGRESS", "DONE"])
export const feedbackListQuery = z.object({
  status: z.enum(["ALL", "OPEN", "IN_PROGRESS", "DONE"]).default("ALL"),
  cursor: z.string().min(1).max(100).optional(),
})
export const feedbackSubmission = z.object({
  interactionId: discordId, guildId: discordId, channelId: discordId,
  authorId: discordId, authorName: z.string().trim().min(1).max(200),
  category: z.enum(["BUG", "IDEA", "OTHER"]),
  title: z.string().trim().min(1).max(120), text: z.string().trim().min(1).max(4000),
})

export function validFeedbackToken(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}
