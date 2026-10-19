import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as unknown, removed: [] as string[] }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/discord-bot", () => ({ removeTrackedMessage: async (id: string) => { if (id === "999") throw new Error("The bot could not remove the message."); state.removed.push(id) } }))
import { DELETE, PUT } from "./route"

const request = (body: unknown) => DELETE(new Request("http://test/api/players/discord/reaction-log", { method: "DELETE", body: JSON.stringify(body) }))

describe("removing tracked Discord messages", () => {
  afterEach(() => { state.session = null; state.removed = [] })

  it("is for signed-in managers only", async () => {
    expect((await request({ messageIds: ["1"] })).status).toBe(401)
    state.session = { user: { id: "player", role: "PLAYER" } }
    expect((await request({ messageIds: ["1"] })).status).toBe(403)
    expect(state.removed).toEqual([])
  })

  it("asks the bot to forget each message and says how many it removed", async () => {
    state.session = { user: { id: "manager", role: "MANAGER" } }
    const response = await request({ messageIds: ["10", "11"] })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ removed: 2 })
    expect(state.removed).toEqual(["10", "11"])
  })

  it("refuses anything that is not a list of message IDs", async () => {
    state.session = { user: { id: "manager", role: "MANAGER" } }
    expect((await request({ messageIds: [] })).status).toBe(400)
    expect((await request({ messageIds: ["abc"] })).status).toBe(400)
    expect((await request({})).status).toBe(400)
  })

  it("reports a failure of the bot instead of pretending it worked", async () => {
    state.session = { user: { id: "manager", role: "MANAGER" } }
    expect((await request({ messageIds: ["999"] })).status).toBe(502)
  })

  it("lets only managers assign a message to a comp", async () => {
    const assign = () => PUT(new Request("http://test/api/players/discord/reaction-log", { method: "PUT", body: JSON.stringify({ messageId: "1", tournamentId: "comp" }) }))
    expect((await assign()).status).toBe(401)
    state.session = { user: { id: "player", role: "PLAYER" } }
    expect((await assign()).status).toBe(403)
  })
})
