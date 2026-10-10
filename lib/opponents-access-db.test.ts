import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), mayEdit: vi.fn() }))
vi.mock("./db", () => ({ db: { tournamentLineup: { findMany: mocks.findMany } } }))
vi.mock("./lineup-access-db", () => ({ LINEUP_ACCESS_SELECT: {}, mayEditLineup: mocks.mayEdit }))
import { mayMaintainOpponent } from "./opponents-access-db"
beforeEach(() => { vi.clearAllMocks() })
describe("opponent maintenance access", () => {
  it("allows central managers without requiring a lineup assignment", async () => {
    expect(await mayMaintainOpponent({ id: "u", role: "MANAGER" }, "c")).toBe(true)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
  it("checks assigned lineups in the requested competition and respects the existing edit deadline", async () => {
    mocks.findMany.mockResolvedValue([{}]); mocks.mayEdit.mockReturnValue(false)
    expect(await mayMaintainOpponent({ id: "u", role: "PLAYER" }, "c")).toBe(false)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tournamentId: "c", managers: { some: { userId: "u" } } } }))
    mocks.mayEdit.mockReturnValue(true)
    expect(await mayMaintainOpponent({ id: "u", role: "PLAYER" }, "c")).toBe(true)
  })
})
