import { describe, expect, it } from "vitest"
import { loadTfhRace } from "./tfh"

const accountId = "bb52ccd2-9073-4102-9244-49ae09e8d81f"
export const tfhResponses: Record<string, unknown> = {
  "/event/24h/race/4/teams": '<p data-eventid="6" data-eventpath="/event/24h/race/4">TFH 24h #4</p><p data-mptext="$fffKingslayer">Kingslayer</p>',
  "/api/event/6/teams": { Teams: [
    { id: 1206, Name: "Winner", Trigram: "WIN", NumberOfCP: 12939, LastCPTime: 86395497, Players: [] },
    { id: 1284, Name: "B2 eSports", Trigram: "$fffB$06f2", NumberOfCP: 12676, LastCPTime: 86395531, Players: [{ id: 3783, User: { AccountId: accountId, DisplayName: "Shoffy" } }] },
  ] },
  "/api/event/6/team/1284": {
    Rank: 2, StartDate: "2025-11-22T14:00:00+00:00", EndDate: "2025-11-23T14:00:00+00:00",
    Team: { id: 1284, Name: "B2 eSports", NumberOfCP: 12676, Players: [{
      id: 3783, User: { AccountId: accountId, DisplayName: "Shoffy" }, NumberOfCP: 3864,
      BestLap: "21555,29024,338299", AverageLap: "21677,29304,346098",
      CalculatedTotalPlayTime: 26315, CPsPerMinute: 8.81,
      Finishes: [{ Timestamp: "2025-11-22T14:06:33+00:00", Time: 391552, Rank: 93, Type: 0 }],
    }] },
  },
}
export function fixtureFetch(responses = tfhResponses): typeof fetch {
  return async (input) => {
    const value = responses[new URL(String(input)).pathname]
    return new Response(typeof value === "string" ? value : JSON.stringify(value), { status: value === undefined ? 503 : 200 })
  }
}

describe("TFH race loading", () => {
  it("does not suggest another club just because its tag ends in b2", async () => {
    const responses = structuredClone(tfhResponses)
    const ranking = responses["/api/event/6/teams"] as { Teams: Array<Record<string, unknown>> }
    ranking.Teams[0].Name = "Big Bonkers Endurance Team 2"
    ranking.Teams[0].Trigram = "$A8Dbb2"
    const race = await loadTfhRace("https://trackmaniaforhours.com/event/24h/race/4", undefined, fixtureFetch(responses))
    expect(race.selectedTeamIds).toEqual([1284])
  })
  it("keeps absent source metrics missing and aborts when any selected team fails to load", async () => {
    const missing = structuredClone(tfhResponses)
    const detail = missing["/api/event/6/team/1284"] as { Team: { Players: Array<Record<string, unknown>> } }
    delete detail.Team.Players[0].CalculatedTotalPlayTime
    detail.Team.Players[0].BestLap = ""
    detail.Team.Players[0].CPsPerMinute = -1
    const race = await loadTfhRace("https://trackmaniaforhours.com/event/24h/race/4", undefined, fixtureFetch(missing))
    expect(race.teams[1].drivers[0]).toMatchObject({ playTimeSeconds: null, bestLapMs: null, cpm: null })
    await expect(loadTfhRace(race.sourceUrl, [1206, 1284], fixtureFetch())).rejects.toThrow("could not be loaded")
  })
  it("refuses an unfinished race and inconsistent or incomplete selected-team data", async () => {
    const future = structuredClone(tfhResponses)
    ;(future["/api/event/6/team/1284"] as Record<string, unknown>).EndDate = "2099-11-23T14:00:00+00:00"
    await expect(loadTfhRace("https://trackmaniaforhours.com/event/24h/race/4", undefined, fixtureFetch(future))).rejects.toThrow("finished")
    const wrong = structuredClone(tfhResponses)
    ;((wrong["/api/event/6/team/1284"] as Record<string, unknown>).Team as Record<string, unknown>).id = 99
    await expect(loadTfhRace("https://trackmaniaforhours.com/event/24h/race/4", undefined, fixtureFetch(wrong))).rejects.toThrow("inconsistent")
    const incomplete = structuredClone(tfhResponses)
    ;((incomplete["/api/event/6/team/1284"] as Record<string, unknown>).Team as Record<string, unknown>).Players = []
    await expect(loadTfhRace("https://trackmaniaforhours.com/event/24h/race/4", undefined, fixtureFetch(incomplete))).rejects.toThrow("incomplete")
    await expect(loadTfhRace("https://trackmaniaforhours.com/event/24h/race/4", [], fixtureFetch())).rejects.toThrow("Select")
  })
  it("rejects URLs outside supported TFH pages before making a request", async () => {
    for (const url of ["https://example.com/event/24h/race/4/teams", "http://trackmaniaforhours.com/event/24h/race/4", "https://trackmaniaforhours.com/event/24h/race/4/teams/extra", "https://user:secret@trackmaniaforhours.com/event/24h/race/4"]) {
      await expect(loadTfhRace(url, undefined, fixtureFetch())).rejects.toThrow("TFH URL")
    }
  })
  it("loads the complete ranking and B2 details with the source's units and checkpoint splits", async () => {
    const race = await loadTfhRace("https://trackmaniaforhours.com/event/24h/race/4/teams", undefined, fixtureFetch())
    expect(race).toMatchObject({ sourceEventId: 6, name: "TFH 24h #4", kind: "24h", mapName: "Kingslayer", selectedTeamIds: [1284] })
    expect(race.teams).toHaveLength(2)
    expect(race.teams[1].drivers[0]).toMatchObject({ accountId, playTimeSeconds: 26315, bestLapMs: 338299, averageLapMs: 346098, checkpoints: 3864, cpm: 8.81, bestSplits: [21555, 29024, 338299], finishes: [{ timeMs: 391552, sourceRank: 93, sourceType: 0 }] })
  })
})
