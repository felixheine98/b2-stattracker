import { beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ role: "PLAYER", update: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { role: state.role } }) }))
vi.mock("@/lib/db", () => ({ db: { appFeedback: { updateMany: state.update } } }))
import { PATCH } from "./route"

describe("feedback status administration", () => {
  const request = (status = "DONE") => new Request("http://test/api/admin/feedback", { method: "PATCH", body: JSON.stringify({ id: "item-1", status }) })
  beforeEach(() => { vi.stubEnv("APP_FEEDBACK", "on"); state.role = "ADMIN"; state.update.mockReset(); state.update.mockResolvedValue({ count: 1 }) })
  it("keeps private feedback restricted to admins, including against direct requests", async () => {
    for (const role of ["PLAYER", "MANAGER"]) {
      state.role = role
      expect((await PATCH(request())).status).toBe(403)
    }
    expect(state.update).not.toHaveBeenCalled()
  })
  it("validates status and returns 404 for missing feedback", async () => {
    expect((await PATCH(request("INVALID"))).status).toBe(400)
    state.update.mockResolvedValue({ count: 0 })
    expect((await PATCH(request())).status).toBe(404)
  })
  it("changes only the selected entry's status", async () => {
    expect((await PATCH(request())).status).toBe(200)
    expect(state.update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { status: "DONE" } })
  })
})
