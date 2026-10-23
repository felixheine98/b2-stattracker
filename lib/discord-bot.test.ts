import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchAnnouncements, fetchServerEmojis, postAnnouncement, fetchReactions, fetchTrackedMessages, removeTrackedMessage, signReactionSnapshot, verifyReactionSnapshot } from "./discord-bot"

const snapshot = { messageUrl: "https://discord.com/channels/111/222/333", fetchedAt: "2026-10-15T12:00:00Z", users: [], reactions: [] }

describe("Discord bot boundary", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("accepts only Discord message links before contacting the configured bot", async () => {
    await expect(fetchReactions("https://example.com/channels/111/222/333", { url: "http://bot:3080", token: "secret" }))
      .rejects.toThrow("Discord message link")
  })
  it("binds the preview to its competition and revision and rejects tampering or expiration", () => {
    const token = signReactionSnapshot({ snapshot, tournamentId: "comp", revision: 3 }, "secret", 1000)
    expect(verifyReactionSnapshot(token, "secret", "comp", 1001)).toMatchObject({ snapshot, revision: 3 })
    expect(() => verifyReactionSnapshot(token, "secret", "other", 1001)).toThrow()
    expect(() => verifyReactionSnapshot(token + "x", "secret", "comp", 1001)).toThrow()
    expect(() => verifyReactionSnapshot(token, "wrong", "comp", 1001)).toThrow()
    expect(() => verifyReactionSnapshot(token, "secret", "comp", 1000 + 15 * 60 * 1000)).toThrow()
  })
  it("keeps the times the bot wrote down, which the signed preview carries on to applying", async () => {
    const timed = { ...snapshot, trackedSince: "2026-10-15T10:00:00.000Z",
      users: [{ id: "anna", name: "Anna" }], reactions: [{ key: "unicode:✅", label: "✅", userIds: ["anna"], reactedAt: { anna: "2026-10-15T11:00:00.000Z" } }] }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(timed)))
    expect(await fetchReactions(timed.messageUrl, { url: "http://bot:3080", token: "api-secret" })).toEqual(timed)
  })
  it("queries the configured bot with authentication and refuses a response for another message", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(snapshot))
    vi.stubGlobal("fetch", fetch)
    expect(await fetchReactions("https://discord.com/channels/111/222/333", { url: "http://bot:3080", token: "api-secret" })).toEqual(snapshot)
    const [url, options] = fetch.mock.calls[0]
    expect(url.toString()).toBe("http://bot:3080/reactions?guildId=111&channelId=222&messageId=333")
    expect(options.headers.Authorization).toBe("Bearer api-secret")
    fetch.mockResolvedValue(Response.json({ ...snapshot, messageUrl: "https://discord.com/channels/111/222/444" }))
    await expect(fetchReactions(snapshot.messageUrl, { url: "http://bot:3080", token: "api-secret" })).rejects.toThrow("different message")
  })
  it("lists the messages the bot keeps reaction times for, and asks it to forget one", async () => {
    const listed = { guildId: "111", messages: [{ messageId: "333", channelId: "222", since: "2026-10-19T20:00:00.000Z", trackedAt: "2026-10-19T20:00:00.000Z", reactions: 2, lastAt: null,
      preview: { channelName: "announcements", author: "Boss", postedAt: "2026-10-19T19:00:00.000Z", text: "EMC S8 lineup", attachments: 0 } }, { messageId: "334", channelId: null, since: "2026-10-19T20:00:00.000Z", trackedAt: "2026-10-19T20:00:00.000Z", reactions: 0, lastAt: null, preview: null }] }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(listed)).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 404 }))
    vi.stubGlobal("fetch", fetch)
    const config = { url: "http://bot:3080", token: "api-secret" }
    expect(await fetchTrackedMessages(config)).toEqual(listed)
    expect(fetch.mock.calls[0][0].toString()).toBe("http://bot:3080/tracked")
    await removeTrackedMessage("333", config)
    expect(fetch.mock.calls[1][0].toString()).toBe("http://bot:3080/tracked/333")
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "DELETE", headers: { Authorization: "Bearer api-secret" } })
    // Already gone is as good as removed
    await expect(removeTrackedMessage("444", config)).resolves.toBeUndefined()
    await expect(removeTrackedMessage("not-an-id", config)).rejects.toThrow("message ID")
  })
  it("asks the bot for the marked pings of a channel and refuses pings from another channel", async () => {
    const ping = { messageUrl: "https://discord.com/channels/111/222/333", messageId: "333", channelId: "222", postedAt: "2026-10-20T18:00:00.000Z", author: "Boss", text: "<@900> Match Day 2" }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ announcements: [ping] })).mockResolvedValueOnce(Response.json({ announcements: [{ ...ping, channelId: "999" }] }))
    vi.stubGlobal("fetch", fetch)
    const config = { url: "http://bot:3080", token: "secret" }
    expect(await fetchAnnouncements("222", config)).toEqual([ping])
    expect(String(fetch.mock.calls[0][0])).toBe("http://bot:3080/announcements?channelId=222")
    expect(fetch.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer secret" })
    await expect(fetchAnnouncements("222", config)).rejects.toThrow()
    await expect(fetchAnnouncements("bad", config)).rejects.toThrow()
  })
  it("asks the bot to post an announcement in the lineup channel and checks what it posted", async () => {
    const posted = { messageUrl: "https://discord.com/channels/111/222/70", messageId: "70", channelId: "222", postedAt: "2026-10-20T18:00:00.000Z", author: "B2 Bot", text: "Who?" }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(posted, { status: 201 })).mockResolvedValueOnce(Response.json({ ...posted, channelId: "999" }, { status: 201 }))
    vi.stubGlobal("fetch", fetch)
    const config = { url: "http://bot:3080", token: "secret" }
    expect(await postAnnouncement("222", "Who?", ["✅", "❌"], config)).toEqual(posted)
    expect(String(fetch.mock.calls[0][0])).toBe("http://bot:3080/announcements")
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ channelId: "222", text: "Who?", emojis: ["✅", "❌"] }) })
    await expect(postAnnouncement("222", "Who?", ["✅"], config)).rejects.toThrow()
  })
  it("lists the server's own emojis and refuses ones the bot made up", async () => {
    const emoji = { key: "custom:501", name: "b2fix", text: "<:b2fix:501>", imageUrl: "https://cdn.discordapp.com/emojis/501.png" }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ emojis: [emoji] })).mockResolvedValueOnce(Response.json({ emojis: [{ ...emoji, text: "<:b2fix:999>" }] }))
    vi.stubGlobal("fetch", fetch)
    const config = { url: "http://bot:3080", token: "secret" }
    expect(await fetchServerEmojis(config)).toEqual([emoji])
    expect(String(fetch.mock.calls[0][0])).toBe("http://bot:3080/emojis")
    await expect(fetchServerEmojis(config)).rejects.toThrow()
  })
})
