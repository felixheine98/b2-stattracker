// Discord for the matchday planning (docs/adr/008): the weekly ping in a lineup's channel marks the
// bot, the planning of a match day suggests the matching one, and its reactions become the answers.
import { reactionPreview, unknownAccounts, type ReactionSnapshot } from "./discord-planning"
import type { MatchdayAnswer } from "./matchday-plan"

export interface Announcement {
  messageUrl: string
  postedAt: string
}

const DAY_MS = 24 * 3600 * 1000

// The latest ping posted before the match day is over that no other match day of the lineup uses yet
export function suggestAnnouncement<A extends Announcement>(announcements: A[], day: Date, taken: string[]): A | null {
  const end = day.getTime() + DAY_MS
  const open = announcements.filter((a) => new Date(a.postedAt).getTime() < end && !taken.includes(a.messageUrl))
  return open.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())[0] ?? null
}

// The lineup channel, from a link to the channel or to a message in it
export function parseChannelLink(link: string): { guildId: string; channelId: string } | null {
  const match = link.trim().match(/^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d{1,20})\/(\d{1,20})(?:\/\d{1,20})?\/?$/)
  return match ? { guildId: match[1], channelId: match[2] } : null
}

// The answers the reactions give the kader. Only linked accounts answer; accounts with a relevant
// reaction but no link are named for an admin to assign (lineup managers do not link accounts, see
// ADR 006), and accounts of players outside the kader are left out. No reaction keeps an answer.
export function matchdayReactionPreview(
  snapshot: ReactionSnapshot,
  emojiMapping: Record<string, MatchdayAnswer | "">,
  links: Record<string, string>,
  notAPlayer: string[],
  kader: Array<{ playerId: string; answer: MatchdayAnswer | null }>,
  resolutions: Record<string, MatchdayAnswer | "">,
) {
  const inKader = new Set(kader.map((p) => p.playerId))
  const identities = Object.fromEntries(Object.entries(links).filter(([, playerId]) => inKader.has(playerId)))
  return {
    rows: reactionPreview<MatchdayAnswer, MatchdayAnswer | null>(snapshot, emojiMapping, identities, kader, resolutions),
    unlinked: unknownAccounts(snapshot, emojiMapping, links, notAPlayer),
  }
}

// The state of the answers as a number: a preview fetched for other answers is not applied
export function answersRevision(answers: Record<string, MatchdayAnswer | null | undefined>): number {
  const text = Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)).map(([id, answer]) => `${id}=${answer ?? ""}`).join(";")
  // FNV-1a, which runs in the browser as well as on the server
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return hash >>> 0
}
