import { describe, expect, it } from "vitest"
import { shapeSummaries } from "./summary"

describe("shapeSummaries", () => {
  it("turns the stored summary of a sub-match into the shape the stats take", () => {
    const [match] = shapeSummaries([{
      id: "m1",
      subMatches: [
        { format: "ROUND_2V2", summary: null },
        {
          format: "ROUND_4V4",
          summary: {
            track: "Roquende", rounds: 12, roundsWon: 3, roundsLost: 7, outcome: "L", sourceUrl: "https://discord.com/x", sourceImage: "1_0",
            players: [{ playerId: "p1", rounds: 12, placementSum: 60, player: { tmId: "tm1", name: "Sebi" } }],
          },
        },
      ],
    }])
    expect(match.subMatches[0].summary).toBeNull()
    expect(match.subMatches[1].summary).toEqual({
      track: "Roquende", rounds: 12, roundsWon: 3, roundsLost: 7, outcome: "L", sourceUrl: "https://discord.com/x", sourceImage: "1_0",
      players: [{ playerId: "p1", tmId: "tm1", playerName: "Sebi", rounds: 12, placementSum: 60 }],
    })
  })
})
