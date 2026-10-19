import { describe, expect, it } from "vitest"
import { formatFetchedAt, importIdentities, previewSummary, reactionPreview, unknownAccounts, validateReactionMapping, type ReactionSnapshot } from "./discord-planning"

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
  it("requires an explicit emoji choice, rejects duplicate players and stale levels, but not unlinked accounts", () => {
    const mapping = { "unicode:✅": "FIX", "unicode:👍": "FIX" } as const
    expect(() => validateReactionMapping(snapshot, {}, {}, ["p1"], [])).toThrow("emoji")
    expect(() => validateReactionMapping(snapshot, mapping, {}, ["p1"], [])).not.toThrow()
    expect(() => validateReactionMapping(snapshot, mapping, { anna: "p1", ben: "p1" }, ["p1"], [])).toThrow("same player")
    expect(() => validateReactionMapping(snapshot, mapping, { anna: "p2", ben: "" }, ["p1"], [])).toThrow("planning")
    expect(() => validateReactionMapping(snapshot, { ...mapping, "unicode:✅": "level:gone" }, { anna: "p1", ben: "" }, ["p1"], [])).toThrow("level")
    expect(() => validateReactionMapping(snapshot, mapping, { anna: "p1", ben: "" }, ["p1"], [])).not.toThrow()
  })
  it("offers only accounts with a relevant reaction that are neither linked nor marked as not a player", () => {
    const three = { ...snapshot, users: [...snapshot.users, { id: "cleo", name: "Cleo" }, { id: "dan", name: "Dan" }],
      reactions: [...snapshot.reactions, { key: "unicode:👀", label: "👀", userIds: ["dan"] }, { key: "unicode:❌", label: "❌", userIds: ["cleo"] }] }
    const mapping = { "unicode:✅": "FIX", "unicode:👍": "FIX", "unicode:👀": "", "unicode:❌": "OUT" } as const
    expect(unknownAccounts(three, mapping, { anna: "p1" }, [])).toEqual([{ id: "ben", name: "Ben" }, { id: "cleo", name: "Cleo" }])
    expect(unknownAccounts(three, mapping, { anna: "p1", cleo: "former" }, ["ben"])).toEqual([])
  })
  it("imports linked accounts without asking and leaves unknown accounts out", () => {
    const players = [{ playerId: "p1", answer: "OPEN" as const }, { playerId: "p2", answer: "MAYBE" as const }]
    const identities = importIdentities({ anna: "p1" }, {})
    expect(reactionPreview(snapshot, { "unicode:✅": "FIX", "unicode:👍": "OUT" }, identities, players, {}))
      .toMatchObject([{ playerId: "p1", kind: "conflict" }, { playerId: "p2", before: "MAYBE", kind: "no-answer" }])
  })
  it("lets a link chosen in the import replace the player's previous account", () => {
    expect(importIdentities({ old: "p1", anna: "p9" }, { ben: "p1" })).toEqual({ anna: "p9", ben: "p1" })
  })
  it("counts changes, conflicts, unchanged answers and players without a reaction", () => {
    const players = [{ playerId: "p1", answer: "FIX" as const }, { playerId: "p2", answer: "OPEN" as const }, { playerId: "p3", answer: "OUT" as const }]
    const rows = reactionPreview(snapshot, { "unicode:✅": "FIX", "unicode:👍": "FIX" }, { anna: "p1", ben: "p2" }, players, {})
    expect(previewSummary(rows)).toEqual({ changes: 1, conflicts: 0, unchanged: 1, withoutReaction: 1 })
  })
})

describe("formatFetchedAt", () => {
  it("writes the time in German local time, in summer and in winter", () => {
    expect(formatFetchedAt("2026-10-19T20:30:56.949Z")).toBe("19.10.2026, 22:30")
    expect(formatFetchedAt("2026-12-01T20:05:00Z")).toBe("01.12.2026, 21:05")
  })
})
