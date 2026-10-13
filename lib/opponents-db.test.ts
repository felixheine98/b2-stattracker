import { describe, expect, it, vi } from "vitest"
vi.mock("./db", () => ({ db: {} }))
import { resolveMatchOpponent, resolveOpponentPlayer, assignmentConflicts, linkOpponentLineups } from "./opponents-db"
import type { Prisma } from "@prisma/client"
const tx = (value: object) => value as Prisma.TransactionClient

describe("match opponent resolution", () => {
  it("rejects lineup IDs from another competition", async () => {
    const db = tx({ opponentLineup: { findUnique: vi.fn().mockResolvedValue({ tournamentId: "other" }) } })
    await expect(resolveMatchOpponent(db, "comp", { lineupId: "foreign" })).rejects.toThrow("tournament")
  })
  it("creates the default lineup from the team roster, without changing older lineups", async () => {
    const create = vi.fn().mockResolvedValue({ id: "new", name: "Team" })
    const db = tx({ opponentTeam: { findUnique: vi.fn().mockResolvedValue({ id: "t", name: "Team", slots: [{ playerId: "p" }] }) }, opponentLineup: { findMany: vi.fn().mockResolvedValue([]), create } })
    await resolveMatchOpponent(db, "comp", { teamId: "t" })
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ tournamentId: "comp", teamId: "t", slots: { create: [{ playerId: "p" }] } }) })
  })
  it("does not silently choose between conflicting name aliases", async () => {
    const db = tx({ opponentLineup: { findMany: vi.fn().mockResolvedValue([{ id: "a", name: "A", aliases: ["Same"] }, { id: "b", name: "B", aliases: ["Same"] }]) } })
    await expect(resolveMatchOpponent(db, "c", { name: "Same" })).rejects.toThrow("ambiguous")
  })
  it("puts a typed name that is a fixed team's alias into that team, also in a new competition", async () => {
    const team = { id: "t", name: "ÆTERNA", aliases: ["Aeterna"], slots: [{ playerId: "p" }] }
    const create = vi.fn().mockResolvedValue({ id: "new", name: "ÆTERNA" })
    const db = tx({ opponentTeam: { findMany: vi.fn().mockResolvedValue([team]), findUnique: vi.fn().mockResolvedValue(team) }, opponentLineup: { findMany: vi.fn().mockResolvedValue([]), create } })
    await resolveMatchOpponent(db, "comp", { name: "aeterna" })
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ tournamentId: "comp", teamId: "t", name: "ÆTERNA", slots: { create: [{ playerId: "p" }] } }) })
  })
})
describe("actual opponent identities", () => {
  it("keeps anonymous placements out of player profiles", async () => {
    expect(await resolveOpponentPlayer(tx({}), "l", "opponent-1", "Team")).toBeNull()
  })
  it("reuses global IDs without promoting opponent-only players into the own pool", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "existing", tmId: "a1234567-1234-1234-1234-123456789012" })
    const db = tx({ player: { upsert } })
    await resolveOpponentPlayer(db, "l", "A1234567-1234-1234-1234-123456789012", "Racer")
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.objectContaining({ isOpponentOnly: true }) }))
  })
  it("retains an explicitly confirmed name-only identity through a replacement import", async () => {
    const db = tx({ opponentIdentity: { findUnique: vi.fn().mockResolvedValue({ player: { id: "confirmed", tmId: "real" } }) } })
    expect(await resolveOpponentPlayer(db, "l", "ecm-Speedy", "Speedy")).toEqual({ id: "confirmed", tmId: "real" })
  })
  it("keeps provisional identities when manually editing their already stored results", async () => {
    const person = { id: "same", tmId: "unknown-same" }
    const db = tx({ player: { findUnique: vi.fn().mockResolvedValue(person) } })
    expect(await resolveOpponentPlayer(db, "l", "unknown-same", "Speedy")).toEqual(person)
  })
  it("applies selected appearance assignments only to their submatch and round", async () => {
    const lookup = vi.fn().mockImplementation(({ where }) => Promise.resolve(where.lineupId_sourceId.sourceId === "appearance:sm:2:ecm-Speedy" ? { player: { id: "confirmed", tmId: "real" } } : { player: { id: "provisional", tmId: "unknown" } }))
    const db = tx({ opponentIdentity: { findUnique: lookup } })
    expect(await resolveOpponentPlayer(db, "l", "ecm-Speedy", "Speedy", { subMatchId: "sm", number: 2 })).toMatchObject({ id: "confirmed" })
    expect(await resolveOpponentPlayer(db, "l", "ecm-Speedy", "Speedy", { subMatchId: "sm", number: 3 })).toMatchObject({ id: "provisional" })
    expect(await resolveOpponentPlayer(db, "l", "ecm-Speedy", "Speedy", { subMatchId: "other-format", number: 2 })).toMatchObject({ id: "provisional" })
  })
  it("rejects assignment collisions and duplicate selected results in the same round", () => {
    expect(assignmentConflicts([{ id: "x", roundId: "r" }], [{ id: "other", roundId: "r" }])).toBe(true)
    expect(assignmentConflicts([{ id: "x", roundId: "r" }, { id: "y", roundId: "r" }], [])).toBe(true)
    expect(assignmentConflicts([{ id: "x", roundId: "r" }], [{ id: "x", roundId: "r" }])).toBe(false)
  })
})

describe("linking an existing participation to a team", () => {
  it("links selected lineups without replacing their roster or matches", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 })
    const db = tx({ opponentTeam: { findUnique: vi.fn().mockResolvedValue({ id: "team" }) }, opponentLineup: { findMany: vi.fn().mockResolvedValue([{ id: "a", teamId: null }, { id: "b", teamId: "team" }]), updateMany } })
    await linkOpponentLineups(db, "team", ["a", "b", "a"])
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ["a", "b"] }, OR: [{ teamId: null }, { teamId: "team" }] }, data: { teamId: "team" } })
  })
  it("does not take a lineup away from another team", async () => {
    const updateMany = vi.fn()
    const db = tx({ opponentTeam: { findUnique: vi.fn().mockResolvedValue({ id: "team" }) }, opponentLineup: { findMany: vi.fn().mockResolvedValue([{ id: "a", teamId: "other" }]), updateMany } })
    await expect(linkOpponentLineups(db, "team", ["a"])).rejects.toThrow("another team")
    expect(updateMany).not.toHaveBeenCalled()
  })
  it("rejects deleted or invalid selections", async () => {
    const db = tx({ opponentTeam: { findUnique: vi.fn().mockResolvedValue({ id: "team" }) }, opponentLineup: { findMany: vi.fn().mockResolvedValue([]) } })
    await expect(linkOpponentLineups(db, "team", ["missing"])).rejects.toThrow("no longer")
  })
})
