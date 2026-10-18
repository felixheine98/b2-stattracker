import { describe, expect, it } from "vitest"
import { reactionPreview, validateReactionMapping, type ReactionSnapshot } from "./discord-planning"

const snapshot: ReactionSnapshot = {
  messageUrl: "https://discord.com/channels/1/2/3", fetchedAt: "2026-10-15T12:00:00Z",
  users: [{ id: "anna", name: "Anna" }, { id: "ben", name: "Ben" }],
  reactions: [
    { key: "unicode:✅", label: "✅", userIds: ["anna"] },
    { key: "unicode:👍", label: "👍", userIds: ["anna", "ben"] },
  ],
}

describe("Discord reactions in competition planning", () => {
  it("accepts several emojis for one status without treating multiple reactions as a conflict", () => {
    expect(reactionPreview(snapshot, { "unicode:✅": "FIX", "unicode:👍": "FIX" },
      { anna: "p1", ben: "p2" }, [{ playerId: "p1", answer: "OPEN" }, { playerId: "p2", answer: "MAYBE" }], {}))
      .toMatchObject([
        { playerId: "p1", before: "OPEN", after: "FIX", kind: "change" },
        { playerId: "p2", before: "MAYBE", after: "FIX", kind: "change" },
      ])
  })
  it("requires an explicit choice for conflicting statuses, including extra levels", () => {
    const mapping = { "unicode:✅": "FIX", "unicode:👍": "level:reserve" } as const
    const players = [{ playerId: "p1", answer: "MAYBE" as const }]
    const preview = (choice: Record<string, "FIX" | "OUT" | "">) => reactionPreview(snapshot, mapping, { anna: "p1" }, players, choice)[0]
    expect(preview({})).toMatchObject({ after: null, kind: "conflict", candidates: ["FIX", "level:reserve"] })
    expect(preview({ p1: "FIX" })).toMatchObject({ after: "FIX", kind: "change" })
    expect(preview({ p1: "" })).toMatchObject({ after: null, kind: "skipped" })
    expect(preview({ p1: "OUT" })).toMatchObject({ after: null, kind: "conflict" })
  })
  it("leaves non-responders, ignored reactions and unmatched accounts unchanged", () => {
    expect(reactionPreview(snapshot, { "unicode:✅": "", "unicode:👍": "" }, { anna: "p1" },
      [{ playerId: "p1", answer: "OUT" }, { playerId: "p2", answer: "INACTIVE" }], {}))
      .toMatchObject([{ after: null, before: "OUT", kind: "no-answer" }, { after: null, before: "INACTIVE", kind: "no-answer" }])
  })
  it("requires explicit emoji and identity choices, rejects duplicate players and stale levels", () => {
    const mapping = { "unicode:✅": "FIX", "unicode:👍": "FIX" } as const
    expect(() => validateReactionMapping(snapshot, {}, {}, ["p1"], [])).toThrow("emoji")
    expect(() => validateReactionMapping(snapshot, mapping, {}, ["p1"], [])).toThrow("account")
    expect(() => validateReactionMapping(snapshot, mapping, { anna: "p1", ben: "p1" }, ["p1"], [])).toThrow("same player")
    expect(() => validateReactionMapping(snapshot, mapping, { anna: "p2", ben: "" }, ["p1"], [])).toThrow("planning")
    expect(() => validateReactionMapping(snapshot, { ...mapping, "unicode:✅": "level:gone" }, { anna: "p1", ben: "" }, ["p1"], [])).toThrow("level")
    expect(() => validateReactionMapping(snapshot, mapping, { anna: "p1", ben: "" }, ["p1"], [])).not.toThrow()
  })
})
