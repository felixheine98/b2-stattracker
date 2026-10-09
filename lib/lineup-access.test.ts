import { describe, expect, it } from "vitest"
import { canEditLineup, lineupEditDeadline, tournamentEndDay } from "./lineup-access"

const stage = (type: "SEEDING" | "GROUP" | "PLAYOFF", number: number) => ({ type, number })
// Seeding on 7 June, match days on 14 and 21 June, playoffs on 28 June
const stages = [stage("SEEDING", 1), stage("GROUP", 1), stage("GROUP", 2), stage("PLAYOFF", 1)]
const tournament = { startDate: new Date("2026-06-07"), endDate: null, createdAt: new Date("2026-06-01"), stages }

describe("tournamentEndDay", () => {
  it("is the entered end date", () => {
    expect(tournamentEndDay({ ...tournament, endDate: new Date("2026-07-05") })).toBe("2026-07-05")
  })

  it("is the day of the last stage when no end date is entered", () => {
    expect(tournamentEndDay(tournament)).toBe("2026-06-28")
  })
})

describe("lineupEditDeadline", () => {
  it("is one week after the end of the tournament", () => {
    expect(lineupEditDeadline(tournament)).toBe("2026-07-05")
  })
})

describe("canEditLineup", () => {
  const lineup = { managerUserIds: ["lena"] }
  const lena = { id: "lena", role: "PLAYER" }

  it("lets admins and managers edit any lineup at any time", () => {
    expect(canEditLineup({ id: "a", role: "ADMIN" }, lineup, tournament, "2030-01-01")).toBe(true)
    expect(canEditLineup({ id: "m", role: "MANAGER" }, lineup, tournament, "2030-01-01")).toBe(true)
  })

  it("lets a lineup manager edit their lineup up to and including the deadline", () => {
    expect(canEditLineup(lena, lineup, tournament, "2026-06-10")).toBe(true)
    expect(canEditLineup(lena, lineup, tournament, "2026-07-05")).toBe(true)
    expect(canEditLineup(lena, lineup, tournament, "2026-07-06")).toBe(false)
  })

  it("does not let them edit other lineups, nor players who are not assigned", () => {
    expect(canEditLineup(lena, { managerUserIds: ["someone-else"] }, tournament, "2026-06-10")).toBe(false)
    expect(canEditLineup({ id: "tom", role: "PLAYER" }, lineup, tournament, "2026-06-10")).toBe(false)
  })

  it("lets nobody edit without being signed in", () => {
    expect(canEditLineup(null, lineup, tournament, "2026-06-10")).toBe(false)
  })
})
