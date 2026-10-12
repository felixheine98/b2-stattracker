import { describe, expect, it } from "vitest"
import { loadTfhRace } from "./tfh"

// Opt-in contract checks against the public source; never writes application data.
describe.skipIf(process.env.TFH_LIVE_TESTS !== "1")("TFH historical source", () => {
  it.each([
    ["24h/race/2", 159, 4], ["24h/race/3", 168, 4], ["24h/race/4", 188, 6],
    ["12h/rpg/1", 150, 6], ["12h/rpg/2", 169, 5], ["12h/rpg/3", 189, 6],
  ])("loads %s with its full ranking and B2 rosters", async (path, teams, b2) => {
    const race = await loadTfhRace(`https://trackmaniaforhours.com/event/${path}/teams`)
    expect(race.teams).toHaveLength(Number(teams))
    expect(race.selectedTeamIds).toHaveLength(Number(b2))
    expect(race.teams.filter(t => race.selectedTeamIds.includes(t.sourceTeamId)).every(t => t.drivers.length === t.roster.length)).toBe(true)
  }, 120000)
})
