import { describe, expect, it } from "vitest"
import { currentStatus, formatDayMonth, guestTmIdsAt, inTeam, mayGetLogin, selectable, statusAt, suggestedStatus, trialTmIdsAt, type PlayerStatusInfo } from "./player-status"

// Not with us before the trial, then on trial, then a member
const player: PlayerStatusInfo = {
  initialStatus: "GUEST",
  statusChanges: [
    { id: "b", status: "MEMBER", effectiveFrom: "2026-09-01" },
    { id: "a", status: "TRIAL", effectiveFrom: "2026-06-30" },
  ],
}

describe("trial status", () => {
  it("applies from its day on until the player becomes a member", () => {
    expect(statusAt(player, "2026-06-29")).toBe("GUEST")
    expect(statusAt(player, "2026-06-30")).toBe("TRIAL")
    expect(statusAt(player, "2026-08-31")).toBe("TRIAL")
    expect(statusAt(player, "2026-09-01")).toBe("MEMBER")
    expect(currentStatus(player)).toBe("MEMBER")
  })

  it("counts as part of the team, unlike a guest", () => {
    expect(inTeam("MEMBER")).toBe(true)
    expect(inTeam("TRIAL")).toBe(true)
    expect(inTeam("GUEST")).toBe(false)
  })

  it("is not listed among the guests", () => {
    expect(guestTmIdsAt([{ ...player, tmId: "ABC" }], "2026-06-01")).toEqual(["abc"])
    expect(guestTmIdsAt([{ ...player, tmId: "ABC" }], "2026-07-01")).toEqual([])
  })
})

describe("suggestedStatus", () => {
  it("offers the most likely next status first: a trial ends in membership", () => {
    expect(suggestedStatus("TRIAL")).toBe("MEMBER")
    expect(suggestedStatus("MEMBER")).toBe("GUEST")
    expect(suggestedStatus("GUEST")).toBe("MEMBER")
    expect(suggestedStatus("FORMER")).toBe("MEMBER")
  })
})

describe("former players", () => {
  const former: PlayerStatusInfo & { tmId: string } = {
    tmId: "XYZ",
    initialStatus: "GUEST",
    statusChanges: [
      { id: "a", status: "TRIAL", effectiveFrom: "2026-03-02" },
      { id: "b", status: "FORMER", effectiveFrom: "2026-06-30" },
    ],
  }

  it("are not part of the team and cannot be picked any more", () => {
    expect(inTeam("FORMER")).toBe(false)
    expect(selectable(former)).toBe(false)
    expect(selectable(player)).toBe(true)
    expect(selectable({ initialStatus: "GUEST", statusChanges: [] })).toBe(true)
  })

  it("show as a guest in a tournament that starts after they left", () => {
    expect(guestTmIdsAt([former], "2026-07-01")).toEqual(["xyz"])
  })

  it("show with the status of the time in earlier tournaments", () => {
    expect(trialTmIdsAt([former], "2026-06-07")).toEqual(["xyz"])
    expect(guestTmIdsAt([former], "2026-06-07")).toEqual([])
    expect(trialTmIdsAt([former], "2026-07-01")).toEqual([])
  })
})

describe("mayGetLogin", () => {
  it("allows a new login for members and trials, but not guests or former players", () => {
    expect(mayGetLogin("MEMBER")).toBe(true)
    expect(mayGetLogin("TRIAL")).toBe(true)
    expect(mayGetLogin("GUEST")).toBe(false)
    expect(mayGetLogin("FORMER")).toBe(false)
  })
})

describe("formatDayMonth", () => {
  it("shows a day without its year", () => {
    expect(formatDayMonth("2026-10-28")).toBe("28.10.")
  })
})
