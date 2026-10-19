import { describe, expect, it } from "vitest"
import { suggestPlayer } from "./discord-accounts"

const players = [
  { id: "uso", names: ["UsoTM"], linked: false },
  { id: "tilt", names: ["DrTilt.", "Dr.Tilt"], linked: false },
  { id: "siri", names: ["Siri_TM"], linked: true },
  { id: "rain1", names: ["Rain"], linked: false },
  { id: "rain2", names: ["rain"], linked: false },
]

describe("suggesting a player for a Discord account", () => {
  it("matches the Discord name, the member directory name or a former player name, ignoring case", () => {
    expect(suggestPlayer({ name: "usotm", username: "x" }, players)).toBe("uso")
    expect(suggestPlayer({ name: "Someone", username: "x", directoryName: "dr.tilt" }, players)).toBe("tilt")
    expect(suggestPlayer({ name: "Someone", username: "drtilt." }, players)).toBe("tilt")
  })

  it("suggests nobody when no name matches, the match is ambiguous or the player already has an account", () => {
    expect(suggestPlayer({ name: "Uso", username: "uso" }, players)).toBeNull()
    expect(suggestPlayer({ name: "Rain", username: "x" }, players)).toBeNull()
    expect(suggestPlayer({ name: "Siri_TM", username: "x" }, players)).toBeNull()
  })
})
