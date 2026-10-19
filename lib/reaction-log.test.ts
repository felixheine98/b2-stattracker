import { describe, expect, it } from "vitest"
import { describeTracked, expiredMessages, removeExpiredMessages } from "./reaction-log"

const tracked = [
  { messageId: "10", channelId: "2", since: "2026-10-19T20:00:00.000Z", trackedAt: "2026-10-19T20:00:00.000Z", reactions: 3, lastAt: "2026-10-19T21:00:00.000Z" },
  { messageId: "11", channelId: "2", since: "2026-10-19T20:00:00.000Z", trackedAt: "2026-10-19T20:00:00.000Z", reactions: 1, lastAt: "2026-10-20T08:00:00.000Z" },
  { messageId: "12", channelId: null, since: "2026-10-18T20:00:00.000Z", trackedAt: "2026-10-18T20:00:00.000Z", reactions: 0, lastAt: null },
]
const plannings = [{ name: "EMC S8", messageUrl: "https://discord.com/channels/1/2/10" }, { name: "Other", messageUrl: "" }]

describe("describeTracked", () => {
  it("names the comp whose announcement a message is, so the others can be told apart", () => {
    const rows = describeTracked("1", tracked, plannings)
    expect(rows.find(r => r.messageId === "10")).toMatchObject({ usedBy: "EMC S8", link: "https://discord.com/channels/1/2/10" })
    expect(rows.find(r => r.messageId === "11")?.usedBy).toBeNull()
  })

  it("lists the latest activity first, messages without reactions last, and has no link without a channel", () => {
    const rows = describeTracked("1", tracked, plannings)
    expect(rows.map(r => r.messageId)).toEqual(["11", "10", "12"])
    expect(rows[2].link).toBeNull()
  })

  it("reads the message from links of other Discord hosts too", () => {
    expect(describeTracked("1", [tracked[0]], [{ name: "X", messageUrl: "https://ptb.discord.com/channels/1/2/10" }])[0].usedBy).toBe("X")
  })
})

describe("messages nobody claimed", () => {
  const week = 7 * 24 * 3600 * 1000
  const base = { channelId: "2", since: "2026-10-19T20:00:00.000Z", reactions: 1, lastAt: null }
  const rows = [
    { ...base, messageId: "10", trackedAt: "2026-10-19T20:00:00.000Z" },
    { ...base, messageId: "11", trackedAt: "2026-10-25T00:00:00.000Z" },
    { ...base, messageId: "12", trackedAt: "2026-10-01T00:00:00.000Z" },
  ]
  const plannings = [{ name: "EMC S8", messageUrl: "https://discord.com/channels/1/2/12" }]

  it("expire a week after tracking began, unless a comp uses them", () => {
    const described = describeTracked("1", rows, plannings)
    expect(described.find(r => r.messageId === "10")?.expiresAt).toBe("2026-10-26T20:00:00.000Z")
    expect(described.find(r => r.messageId === "12")?.expiresAt).toBeNull()
  })

  it("are the unused ones whose week is over", () => {
    const now = new Date("2026-10-26T20:00:01Z")
    expect(expiredMessages(describeTracked("1", rows, plannings), now)).toEqual(["10"])
    expect(expiredMessages(describeTracked("1", rows, plannings), new Date(new Date("2026-10-26T20:00:00Z").getTime() - 1))).toEqual([])
    expect(week).toBe(604800000)
  })

  it("are removed through the bot, nothing at all when the comps cannot be read", async () => {
    const removed: string[] = []
    const deps = { list: async () => ({ guildId: "1", messages: rows }), remove: async (id: string) => { removed.push(id) }, now: () => new Date("2026-10-26T20:00:01Z") }
    expect(await removeExpiredMessages({ ...deps, plannings: async () => plannings })).toEqual(["10"])
    expect(removed).toEqual(["10"])
    removed.length = 0
    await expect(removeExpiredMessages({ ...deps, plannings: async () => { throw new Error("database down") } })).rejects.toThrow("database down")
    expect(removed).toEqual([])
  })
})
