import { describe, expect, it, vi } from "vitest"
import { confirmMatch } from "./match-confirmation"
import type { Prisma } from "@prisma/client"
describe("confirmed match outcomes", () => {
  it("rejects a stale revision without recording a confirmation", async () => {
    const create = vi.fn(), tx = { match: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, matchConfirmation: { create } } as unknown as Prisma.TransactionClient
    await expect(confirmMatch(tx, { matchId: "m", revision: 2, outcome: "W", userId: "u" })).rejects.toThrow("changed")
    expect(create).not.toHaveBeenCalled()
  })
  it("stores the confirmed outcome and its immutable revision/user audit together", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 }), create = vi.fn()
    const tx = { match: { updateMany }, matchConfirmation: { create } } as unknown as Prisma.TransactionClient
    await confirmMatch(tx, { matchId: "m", revision: 2, outcome: "L", userId: "u" })
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m", resultRevision: 2 }, data: { closedAt: expect.any(Date), confirmedOutcome: "L" } }))
    expect(create).toHaveBeenCalledWith({ data: { matchId: "m", revision: 2, outcome: "L", userId: "u" } })
  })
})
