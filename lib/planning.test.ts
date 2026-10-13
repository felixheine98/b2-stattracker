import { describe, expect, it } from "vitest"
import { answerOf, planningRows, type PlanningEntryData } from "./planning"

const member = (id: string, name: string) => ({ id, name, initialStatus: "MEMBER" as const, statusChanges: [] })
const guest = (id: string, name: string) => ({ id, name, initialStatus: "GUEST" as const, statusChanges: [] })
const entry = (playerId: string, data: Partial<PlanningEntryData> = {}): PlanningEntryData => ({
  playerId,
  status: null,
  levelId: null,
  note: null,
  ...data,
})

const players = [member("uso", "UsoTM"), member("sebi", "LPNSebi"), guest("yahoo", "Yahoo"), guest("extra", "Extra")]

describe("answerOf", () => {
  it("is open while nothing was answered", () => {
    expect(answerOf(undefined)).toBe("OPEN")
    expect(answerOf(entry("uso"))).toBe("OPEN")
  })

  it("is the fixed level or the planning's own extra level", () => {
    expect(answerOf(entry("uso", { status: "MAYBE" }))).toBe("MAYBE")
    expect(answerOf(entry("uso", { levelId: "sub" }))).toBe("level:sub")
  })
})

describe("inactive members", () => {
  const tra = { ...member("tra", "TraTM"), inactive: true }

  it("count as inactive instead of open while they have not answered", () => {
    expect(answerOf(undefined, true)).toBe("INACTIVE")
    expect(answerOf(entry("tra"), true)).toBe("INACTIVE")
    const rows = planningRows([...players, tra], [], "2026-06-07")
    expect(rows.map((r) => [r.player.name, r.answer])).toEqual([
      ["LPNSebi", "OPEN"],
      ["TraTM", "INACTIVE"],
      ["UsoTM", "OPEN"],
    ])
    expect(rows.filter((r) => r.answer === "OPEN")).toHaveLength(2)
  })

  it("are listed with their own answer once they give one for a tournament", () => {
    expect(answerOf(entry("tra", { status: "FIX" }), true)).toBe("FIX")
    expect(answerOf(entry("tra", { levelId: "sub" }), true)).toBe("level:sub")
    const rows = planningRows([tra], [entry("tra", { status: "MAYBE" })], "2026-06-07")
    expect(rows.map((r) => r.answer)).toEqual(["MAYBE"])
  })
})

describe("planningRows", () => {
  it("lists every member, answered or not, in alphabetical order", () => {
    const rows = planningRows(players, [entry("uso", { status: "FIX" })], "2026-06-07")
    expect(rows.map((r) => [r.player.name, r.answer])).toEqual([
      ["LPNSebi", "OPEN"],
      ["UsoTM", "FIX"],
    ])
  })

  it("lists a guest only once added to the planning", () => {
    const rows = planningRows(players, [entry("yahoo")], "2026-06-07")
    expect(rows.map((r) => [r.player.name, r.guest])).toEqual([
      ["LPNSebi", false],
      ["UsoTM", false],
      ["Yahoo", true],
    ])
  })

  it("goes by who is member or guest on the tournament's start day", () => {
    const later = { ...guest("late", "Late"), statusChanges: [{ id: "c", status: "MEMBER" as const, effectiveFrom: "2026-07-01" }] }
    expect(planningRows([later], [], "2026-06-07")).toEqual([])
    expect(planningRows([later], [], "2026-07-01").map((r) => r.player.name)).toEqual(["Late"])
  })
})
