import { describe, expect, it } from "vitest"
import { describeTracked } from "./reaction-log"

const tracked = [
  { messageId: "10", channelId: "2", since: "2026-10-19T20:00:00.000Z", reactions: 3, lastAt: "2026-10-19T21:00:00.000Z" },
  { messageId: "11", channelId: "2", since: "2026-10-19T20:00:00.000Z", reactions: 1, lastAt: "2026-10-20T08:00:00.000Z" },
  { messageId: "12", channelId: null, since: "2026-10-18T20:00:00.000Z", reactions: 0, lastAt: null },
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
