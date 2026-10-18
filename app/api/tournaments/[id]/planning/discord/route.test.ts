import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as unknown }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/db", () => ({ db: {} }))
import { POST } from "./route"

describe("Discord import authorization", () => {
  afterEach(() => { state.session = null })
  const request = () => POST(new Request("http://test/api/discord", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "comp" }) })
  it("requires a signed-in manager before accessing the bot or planning data", async () => {
    expect((await request()).status).toBe(401)
    state.session = { user: { id: "player", role: "PLAYER" } }
    expect((await request()).status).toBe(403)
    state.session = { user: { id: "manager", role: "MANAGER" } }
    expect((await request()).status).toBe(400)
  })
})
