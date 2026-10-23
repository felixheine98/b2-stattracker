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

// An emoji the bot sets under the announcement it posts, and the answer it stands for. `key` names it
// the way a reaction snapshot does ("unicode:✅", "custom:<id>"), `text` is how it is written in a
// message and given to the bot to react with ("✅", "<:name:id>").
export interface EmojiChoice {
  key: string
  text: string
  answer: MatchdayAnswer
}

const LABEL: Record<MatchdayAnswer, string> = { FIX: "Fix", PARTIAL: "Partly", MAYBE: "Maybe", OUT: "Out" }

export const DEFAULT_EMOJIS: readonly EmojiChoice[] = [
  { key: "unicode:✅", text: "✅", answer: "FIX" },
  { key: "unicode:🕗", text: "🕗", answer: "PARTIAL" },
  { key: "unicode:❔", text: "❔", answer: "MAYBE" },
  { key: "unicode:❌", text: "❌", answer: "OUT" },
]

// What the emojis of a posted announcement mean
export const emojiMapping = (choices: readonly EmojiChoice[]): Record<string, MatchdayAnswer> =>
  Object.fromEntries(choices.map((e) => [e.key, e.answer]))

// What each emoji means, as the announcement says it
export const emojiLegend = (choices: readonly EmojiChoice[]): string => choices.map((e) => `${e.text} ${LABEL[e.answer]}`).join(" · ")

const CUSTOM = /^<a?:\w{2,32}:(\d{1,20})>$/

// What is wrong with the emojis of an announcement, or null
export function checkEmojis(choices: readonly EmojiChoice[]): string | null {
  if (choices.length === 0) return "Choose at least one emoji."
  if (choices.length > 10) return "Choose at most 10 emojis."
  if (new Set(choices.map((e) => e.key)).size !== choices.length) return "An emoji is chosen twice."
  for (const e of choices) {
    const custom = e.text.match(CUSTOM)
    const fits = custom ? e.key === `custom:${custom[1]}` : e.key === `unicode:${e.text}` && e.text.length > 0 && e.text.length <= 16 && !/[\s<>:]/.test(e.text)
    if (!fits || !(e.answer in LABEL)) return "An emoji cannot be read. Choose it again."
  }
  return null
}

// The emojis of the lineup's latest posted announcement, otherwise the default ones
export function lastUsedEmojis(settings: Array<{ emojis?: readonly EmojiChoice[]; postedAt?: string }>): EmojiChoice[] {
  const posted = settings.filter((s) => s.emojis?.length && s.postedAt).sort((a, b) => b.postedAt!.localeCompare(a.postedAt!))
  return [...(posted[0]?.emojis ?? DEFAULT_EMOJIS)]
}

const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short" })
const dayMonth = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" })

// The text the planning offers for the announcement, to be changed before posting
export function announcementText(stage: string, day: Date, choices: readonly EmojiChoice[]): string {
  return `Who is there for ${stage} on ${weekday.format(day)} ${dayMonth.format(day)}?\n${emojiLegend(choices)}`
}

// One of the server's own emojis, as the bot lists them
export interface ServerEmoji {
  key: string
  text: string
  name: string
  imageUrl: string
}

// Common emojis to choose from without copying them, with words to find them by
const COMMON: Array<[string, string]> = [
  ["✅", "check yes fix done"], ["✔️", "check mark yes"], ["☑️", "ballot check yes"], ["👍", "thumbs up yes"], ["👌", "ok"], ["💪", "strong muscle"],
  ["🟢", "green circle yes"], ["🟩", "green square yes"], ["💚", "green heart"], ["🔥", "fire"], ["⭐", "star"], ["🏁", "race flag finish"], ["🏎️", "race car"],
  ["🕗", "clock eight partly late time"], ["🕘", "clock nine time"], ["🕙", "clock ten time"], ["⏰", "alarm clock time late"], ["⏳", "hourglass time partly"], ["🌗", "half moon partly"],
  ["🟡", "yellow circle partly maybe"], ["🟨", "yellow square maybe"], ["🟠", "orange circle partly"],
  ["❔", "question maybe"], ["❓", "question red maybe"], ["🤔", "thinking maybe"], ["🤷", "shrug maybe"], ["🔵", "blue circle maybe"],
  ["❌", "cross no out"], ["✖️", "multiply no out"], ["🚫", "no entry prohibited out"], ["⛔", "no entry out"], ["👎", "thumbs down no out"], ["🔴", "red circle no out"], ["🟥", "red square no out"], ["😴", "sleeping out"],
  ["1️⃣", "one first match"], ["2️⃣", "two second match"], ["3️⃣", "three third match"], ["4️⃣", "four fourth match"], ["5️⃣", "five fifth match"],
  ["🅰️", "a letter"], ["🅱️", "b letter"], ["🎮", "game controller"], ["🏆", "trophy cup"], ["🎉", "party"],
]

// The emojis whose name holds the typed text: the server's own first, then common ones
export function searchEmojis(query: string, server: ServerEmoji[]): Array<{ key: string; text: string; name: string; imageUrl?: string }> {
  const text = query.trim().toLowerCase()
  const common = COMMON.map(([emoji, name]) => ({ key: `unicode:${emoji}`, text: emoji, name }))
  return [...server, ...common].filter((e) => !text || e.name.toLowerCase().includes(text))
}

// Text inserted at the cursor of a text field, in place of what is selected; the cursor goes behind it
export function insertAt(text: string, start: number, end: number, insert: string): { text: string; cursor: number } {
  return { text: text.slice(0, start) + insert + text.slice(end), cursor: start + insert.length }
}
