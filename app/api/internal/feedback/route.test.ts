import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ panel: vi.fn(), upsert: vi.fn(), list: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: {
  feedbackPanel: { findUnique: state.panel },
  appFeedback: { upsert: state.upsert, findMany: state.list },
} }))
import { GET, POST } from "./route"

describe("bot feedback endpoint", () => {
  const input = { interactionId: "123", guildId: "456", channelId: "789", authorId: "1234", authorName: "Player", category: "BUG", title: "Broken button", text: "Does not save" }
  const request = (body: unknown, token = "secret") => new Request("http://test/api/internal/feedback", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  beforeEach(() => {
    vi.stubEnv("APP_FEEDBACK", "on")
    vi.stubEnv("DISCORD_BOT_API_TOKEN", "secret")
    vi.clearAllMocks()
    state.panel.mockResolvedValue({ guildId: "456", channelId: "789" })
    state.upsert.mockResolvedValue({ id: "feedback-1" })
    state.list.mockResolvedValue([])
  })
  it("rejects requests without the bot secret before accessing data", async () => {
    expect((await POST(request(input, "wrong"))).status).toBe(401)
    expect(state.panel).not.toHaveBeenCalled()
  })
  it("is unavailable when switched off", async () => {
    vi.stubEnv("APP_FEEDBACK", "off")
    expect((await POST(request(input))).status).toBe(404)
  })
  it("rejects another server/channel and malformed feedback", async () => {
    expect((await POST(request({ ...input, guildId: "999" }))).status).toBe(403)
    expect((await POST(request({ ...input, channelId: "999" }))).status).toBe(403)
    expect((await POST(request({ ...input, text: " " }))).status).toBe(400)
    expect(state.upsert).not.toHaveBeenCalled()
  })
  it("deduplicates deliveries by interaction without overwriting existing feedback", async () => {
    expect((await POST(request(input))).status).toBe(200)
    expect(state.upsert).toHaveBeenCalledWith({ where: { interactionId: "123" }, create: input, update: {} })
  })
  it("lists only the requesting Discord user's feedback with bounded pagination", async () => {
    const response = await GET(new Request("http://test/api/internal/feedback?guildId=456&channelId=789&authorId=1234", { headers: { Authorization: "Bearer secret" } }))
    expect(response.status).toBe(200)
    expect(state.list.mock.calls[0][0]).toMatchObject({ where: { guildId: "456", authorId: "1234" }, take: 6 })
    expect((await response.json()).items).toEqual([])
  })
  it("returns a next-page cursor without exposing the extra lookahead entry", async () => {
    state.list.mockResolvedValue(Array.from({ length: 6 }, (_, index) => ({ id: `entry-${index}` })))
    const response = await GET(new Request("http://test/api/internal/feedback?guildId=456&channelId=789&authorId=1234&cursor=previous", { headers: { Authorization: "Bearer secret" } }))
    const data = await response.json()
    expect(data.items).toHaveLength(5)
    expect(data.nextCursor).toBe("entry-4")
    expect(state.list.mock.calls[0][0]).toMatchObject({ where: { guildId: "456", authorId: "1234" }, cursor: { id: "previous" }, skip: 1 })
  })
})
