import { describe, expect, it } from "vitest"
import { currentStatus, guestTmIdsAt, inTeam, statusAt, suggestedStatus, type PlayerStatusInfo } from "./player-status"

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
  })
})
