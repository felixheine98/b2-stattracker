import { describe, expect, it } from "vitest"
import { DEFAULT_EMOJIS, announcementText, checkEmojis, emojiLegend, emojiMapping, insertAt, lastUsedEmojis, searchEmojis, answersRevision, matchdayReactionPreview, parseChannelLink, suggestAnnouncement } from "./matchday-discord"

const ping = (id: string, postedAt: string) => ({ messageUrl: `https://discord.com/channels/1/2/${id}`, postedAt })

describe("suggestAnnouncement", () => {
  const pings = [ping("30", "2026-10-28T17:00:00.000Z"), ping("20", "2026-10-20T17:00:00.000Z"), ping("10", "2026-10-13T17:00:00.000Z")]

  it("suggests the latest ping posted before the match day is over", () => {
    expect(suggestAnnouncement(pings, new Date("2026-10-22T00:00:00.000Z"), [])?.messageUrl).toBe(pings[1].messageUrl)
    expect(suggestAnnouncement(pings, new Date("2026-10-20T00:00:00.000Z"), [])?.messageUrl).toBe(pings[1].messageUrl)
  })

  it("skips pings that already belong to another match day of the lineup", () => {
    expect(suggestAnnouncement(pings, new Date("2026-10-22T00:00:00.000Z"), [pings[1].messageUrl])?.messageUrl).toBe(pings[2].messageUrl)
  })

  it("suggests nothing when every ping is later or taken", () => {
    expect(suggestAnnouncement(pings, new Date("2026-10-10T00:00:00.000Z"), [])).toBeNull()
    expect(suggestAnnouncement(pings.slice(1), new Date("2026-10-22T00:00:00.000Z"), pings.map((p) => p.messageUrl))).toBeNull()
  })
})

describe("parseChannelLink", () => {
  it("reads the channel from a link to the channel or to a message in it", () => {
    expect(parseChannelLink("https://discord.com/channels/111/222")).toEqual({ guildId: "111", channelId: "222" })
    expect(parseChannelLink(" https://ptb.discord.com/channels/111/222/333 ")).toEqual({ guildId: "111", channelId: "222" })
  })

  it("refuses anything else", () => {
    expect(parseChannelLink("https://discord.com/channels/111")).toBeNull()
    expect(parseChannelLink("https://example.com/channels/111/222")).toBeNull()
    expect(parseChannelLink("222")).toBeNull()
  })
})

describe("matchdayReactionPreview", () => {
  const snapshot = {
    messageUrl: "https://discord.com/channels/1/2/3", fetchedAt: "2026-10-21T10:00:00.000Z",
    users: [{ id: "d-anna", name: "Anna" }, { id: "d-ben", name: "Ben" }, { id: "d-cleo", name: "Cleo" }, { id: "d-zoe", name: "Zoe" }, { id: "d-guest", name: "Guest" }, { id: "d-bot", name: "Helper" }],
    reactions: [
      { key: "unicode:✅", label: "✅", userIds: ["d-anna", "d-zoe", "d-guest"], reactedAt: { "d-anna": "2026-10-20T18:05:00.000Z" } },
      { key: "unicode:🕗", label: "🕗", userIds: ["d-ben"] },
      { key: "unicode:🎉", label: "🎉", userIds: ["d-cleo", "d-bot"] },
    ],
  }
  const mapping = { "unicode:✅": "FIX", "unicode:🕗": "PARTIAL", "unicode:🎉": "" } as const
  // Zoe is linked but plays in another lineup; Guest has no link; Helper is marked as not a player
  const links = { "d-anna": "anna", "d-ben": "ben", "d-cleo": "cleo", "d-zoe": "zoe" }
  const kader = [{ playerId: "anna", answer: null }, { playerId: "ben", answer: "MAYBE" as const }, { playerId: "cleo", answer: "OUT" as const }]

  it("turns the reactions of the kader into answers, with the time of the reaction", () => {
    const { rows } = matchdayReactionPreview(snapshot, mapping, links, ["d-bot"], kader, {})
    expect(rows).toEqual([
      { playerId: "anna", before: null, after: "FIX", candidates: ["FIX"], times: { FIX: "2026-10-20T18:05:00.000Z" }, kind: "change" },
      { playerId: "ben", before: "MAYBE", after: "PARTIAL", candidates: ["PARTIAL"], times: {}, kind: "change" },
      // An ignored emoji keeps the answer
      { playerId: "cleo", before: "OUT", after: null, candidates: [], times: {}, kind: "no-answer" },
    ])
  })

  it("names accounts with a relevant reaction but no link, for an admin to assign; players outside the kader are left out silently", () => {
    const { unlinked } = matchdayReactionPreview(snapshot, mapping, links, ["d-bot"], kader, {})
    expect(unlinked).toEqual([{ id: "d-guest", name: "Guest" }])
  })

  it("asks to resolve a player who reacted with two answers, and lets a choice settle it", () => {
    const two = { ...snapshot, reactions: [...snapshot.reactions, { key: "unicode:❌", label: "❌", userIds: ["d-anna"] }] }
    const both = { ...mapping, "unicode:❌": "OUT" } as const
    expect(matchdayReactionPreview(two, both, links, [], kader, {}).rows[0].kind).toBe("conflict")
    expect(matchdayReactionPreview(two, both, links, [], kader, { anna: "OUT" }).rows[0]).toMatchObject({ after: "OUT", kind: "change" })
  })
})

describe("answersRevision", () => {
  it("stays the same for the same answers in any order, and changes with any answer", () => {
    const answers = { anna: "FIX", ben: null, cleo: "OUT" } as const
    expect(answersRevision({ cleo: "OUT", anna: "FIX", ben: null })).toBe(answersRevision(answers))
    expect(answersRevision({ ...answers, ben: "MAYBE" })).not.toBe(answersRevision(answers))
    expect(answersRevision({ ...answers, dora: "FIX" })).not.toBe(answersRevision(answers))
    expect(Number.isInteger(answersRevision(answers)) && answersRevision(answers) >= 0).toBe(true)
  })
})

describe("the emojis of an announcement the bot posts", () => {
  const custom = { key: "custom:501", text: "<:b2fix:501>", answer: "FIX" as const }

  it("start with one emoji per answer, which read back the way a snapshot names them", () => {
    expect(DEFAULT_EMOJIS.map((e) => [e.text, e.answer])).toEqual([["✅", "FIX"], ["🕗", "PARTIAL"], ["❔", "MAYBE"], ["❌", "OUT"]])
    expect(emojiMapping(DEFAULT_EMOJIS)).toEqual({ "unicode:✅": "FIX", "unicode:🕗": "PARTIAL", "unicode:❔": "MAYBE", "unicode:❌": "OUT" })
  })

  it("can be any emojis, the server's own too, and several for one answer", () => {
    const choices = [custom, { key: "unicode:👍", text: "👍", answer: "FIX" as const }, { key: "unicode:🚫", text: "🚫", answer: "OUT" as const }]
    expect(emojiMapping(choices)).toEqual({ "custom:501": "FIX", "unicode:👍": "FIX", "unicode:🚫": "OUT" })
    expect(emojiLegend(choices)).toBe("<:b2fix:501> Fix · 👍 Fix · 🚫 Out")
    expect(checkEmojis(choices)).toBeNull()
  })

  it("refuse no emoji, too many, the same emoji twice and a key that does not match the emoji", () => {
    expect(checkEmojis([])).toMatch(/at least one/i)
    expect(checkEmojis(Array.from({ length: 11 }, (_, i) => ({ key: `custom:${500 + i}`, text: `<:e${i}:${500 + i}>`, answer: "FIX" as const })))).toMatch(/at most 10/i)
    expect(checkEmojis([DEFAULT_EMOJIS[0], { ...DEFAULT_EMOJIS[0], answer: "OUT" }])).toMatch(/twice/i)
    expect(checkEmojis([{ key: "custom:501", text: "<:b2fix:999>", answer: "FIX" }])).toMatch(/emoji/i)
    expect(checkEmojis([{ key: "unicode:✅", text: "❌", answer: "FIX" }])).toMatch(/emoji/i)
  })

  it("offer the emojis the lineup used last, otherwise the default ones", () => {
    const mine = [custom]
    expect(lastUsedEmojis([{ emojis: DEFAULT_EMOJIS, postedAt: "2026-10-13T18:00:00.000Z" }, { emojis: mine, postedAt: "2026-10-20T18:00:00.000Z" }, {}])).toEqual(mine)
    expect(lastUsedEmojis([{}])).toEqual(DEFAULT_EMOJIS)
  })

  it("ask by default who is there on the match day and say what each emoji means", () => {
    expect(announcementText("Match Day 2", new Date("2026-10-28T00:00:00.000Z"), DEFAULT_EMOJIS)).toBe("Who is there for Match Day 2 on Wed 28.10.?\n✅ Fix · 🕗 Partly · ❔ Maybe · ❌ Out")
  })
})

describe("searchEmojis", () => {
  const server = [{ key: "custom:501", text: "<:b2fix:501>", name: "b2fix", imageUrl: "https://cdn.discordapp.com/emojis/501.png" }]

  it("finds the server's own emojis and common ones by name, the server's first", () => {
    expect(searchEmojis("fix", server).map((e) => e.key)).toEqual(["custom:501", "unicode:✅"])
    expect(searchEmojis("b2", server).map((e) => e.key)).toEqual(["custom:501"])
    expect(searchEmojis("thumb", server).map((e) => e.text)).toContain("👍")
    expect(searchEmojis("", server)[0].key).toBe("custom:501")
  })
})

describe("insertAt", () => {
  it("puts the text where the cursor is, replacing a selection, and moves the cursor behind it", () => {
    expect(insertAt("Who is there?", 13, 13, " ✅")).toEqual({ text: "Who is there? ✅", cursor: 15 })
    expect(insertAt("Fix: X", 5, 6, "✅")).toEqual({ text: "Fix: ✅", cursor: 6 })
    expect(insertAt("ab", 1, 1, "<:b2fix:501>")).toEqual({ text: "a<:b2fix:501>b", cursor: 13 })
  })
})
