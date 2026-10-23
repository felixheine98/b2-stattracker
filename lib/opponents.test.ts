import { describe, expect, it } from "vitest"
import { confirmedTmId, opponentNameKey, resolveOpponentName, suggestMatchOutcome, opponentStats, rosterDifference, relatedLineupIds, findRosterIdentity, matchingTeamLineups } from "./opponents"

describe("opponent identity", () => {
  it("accepts real account IDs only, never synthetic name/position IDs", () => {
    expect(confirmedTmId("A1234567-1234-1234-1234-123456789012")).toBe("a1234567-1234-1234-1234-123456789012")
    for (const id of ["ecm-Speedy", "opponent-1", "unknown-foo", "Speedy"]) expect(confirmedTmId(id)).toBeNull()
  })
  it("normalizes names but refuses ambiguous aliases", () => {
    expect(opponentNameKey("  Team   ROCKETS ")).toBe("team rockets")
    const entries = [{ id: "a", name: "Rockets", aliases: ["Team Rockets"] }, { id: "b", name: "Mix", aliases: ["Team Rockets"] }]
    expect(resolveOpponentName("rockets", entries)).toBe("a")
    expect(resolveOpponentName("TEAM ROCKETS", entries)).toBeNull()
  })
  it("reports roster additions/removals without overwriting the local roster", () => {
    expect(rosterDifference([{ name: "A" }, { name: "Local" }], [{ name: "a" }, { name: "New" }])).toEqual({ added: ["New"], removed: ["Local"] })
  })
  it("finds linked participations across competitions, including branches, but not unrelated same-name teams", () => {
    expect(relatedLineupIds("b", [{ id: "a", previousId: null }, { id: "b", previousId: "a" }, { id: "c", previousId: "a" }, { id: "other", previousId: null }]).sort()).toEqual(["a", "b", "c"])
  })
  it("keeps a confirmed roster identity when its spreadsheet nickname differs from the account name", () => {
    const known = { id: "p", name: "Current", initialName: "Current", opponentNames: ["old nick"] }
    expect(findRosterIdentity([known], "OLD Nick")).toBe(known)
    expect(findRosterIdentity([known, { ...known, id: "other" }], "old nick")).toBeNull()
  })
})

const results = [
  { tmId: "a1234567-1234-1234-1234-123456789012", playerId: "opp", playerName: "Speedy", isOurTeam: false, timeMs: 1000, dnf: false },
  { tmId: "own", playerName: "Ours", isOurTeam: true, timeMs: 1200, dnf: false },
]
const match = { id: "m", tournamentId: "c", tournament: { name: "Comp" }, stage: { type: "GROUP" }, closedAt: null, confirmedOutcome: null, subMatches: [{ format: "ROUND_1V1", rounds: [{ track: "Map", results }] }] }

describe("opponent statistics", () => {
  it("suggests submatch results and leaves matches without scored rounds unknown", () => {
    expect(suggestMatchOutcome(match.subMatches)).toBe("L")
    expect(suggestMatchOutcome([{ rounds: [{ results: results.filter(r => !r.isOurTeam) }] }])).toBeNull()
  })
  it("counts only completed matches in our match balance, but actual opponent rounds independently", () => {
    const stats = opponentStats([match, { ...match, id: "closed", closedAt: new Date(), confirmedOutcome: "W" }])
    expect(stats.balance).toEqual({ won: 1, drawn: 0, lost: 0, open: 1, upcoming: 0 })
    expect(stats.players[0]).toMatchObject({ playerId: "opp", played: 2, won: 2, lost: 0, points: 4, avgPlace: 1, measured: 2 })
  })
  it("counts a planned match without rounds as upcoming, not as open", () => {
    const planned = { ...match, id: "planned", subMatches: [] }
    expect(opponentStats([match, planned]).balance).toEqual({ won: 0, drawn: 0, lost: 0, open: 1, upcoming: 1 })
  })
  it("separates formats, competitions and maps and excludes unknown map times and DNF times", () => {
    const other = { ...match, id: "other", tournamentId: "d", subMatches: [{ format: "ROUND_2V2", rounds: [{ track: "Map", results }] }] }
    const missing = { ...match, id: "missing", subMatches: [{ format: "ROUND_1V1", rounds: [{ track: null, results: results.map(r => ({ ...r, timeMs: null })) }, { track: "Map", results: results.map(r => ({ ...r, dnf: !r.isOurTeam, timeMs: 999 })) }] }] }
    const stats = opponentStats([match, other, missing])
    expect(stats.players).toHaveLength(2)
    expect(stats.maps).toHaveLength(2)
    expect(stats.maps.find(m => m.tournamentId === "c")).toMatchObject({ measured: 1, best: 1000 })
    expect(stats.players.find(p => p.format === "ROUND_1V1")).toMatchObject({ played: 3, dnfs: 1, measured: 1 })
  })
  it("does not aggregate anonymous or unresolved identities into global personal statistics", () => {
    const stats = opponentStats([{ ...match, subMatches: [{ format: "ROUND_1V1", rounds: [{ track: "Map", results: results.map(r => ({ ...r, tmId: "ecm-Speedy" })) }] }] }])
    expect(stats.players).toEqual([])
    expect(stats.maps).toEqual([])
  })
})

it("suggests only unlinked lineups whose full name matches the imported team", () => {
  const rows = [{ id: "a", name: " Good   Focus ", teamId: null }, { id: "b", name: "Good Focus Academy", teamId: null }, { id: "c", name: "Good Focus", teamId: "other" }]
  expect(matchingTeamLineups("GOOD FOCUS", rows)).toEqual([rows[0]])
})
