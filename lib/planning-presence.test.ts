import { describe, expect, it } from "vitest"
import { createPresence } from "./planning-presence"

const idle = { variantId: null, playerId: null, typing: null }

describe("presence", () => {
  it("lists who was seen recently, with what they are doing", () => {
    const presence = createPresence()
    presence.touch("t1", { id: "shoffy", name: "Shoffy" }, idle, 1000)
    presence.touch("t1", { id: "paszs", name: "PASZS" }, { variantId: "v1", playerId: "anna", typing: null }, 2000)
    expect(presence.list("t1", 2500)).toEqual([
      { userId: "paszs", name: "PASZS", activity: { variantId: "v1", playerId: "anna", typing: null } },
      { userId: "shoffy", name: "Shoffy", activity: idle },
    ])
  })

  it("drops someone who has not been seen for a few seconds", () => {
    const presence = createPresence()
    presence.touch("t1", { id: "shoffy", name: "Shoffy" }, idle, 1000)
    expect(presence.list("t1", 1000 + 5999)).toHaveLength(1)
    expect(presence.list("t1", 1000 + 6001)).toEqual([])
  })

  it("keeps the plannings of different tournaments apart", () => {
    const presence = createPresence()
    presence.touch("t1", { id: "shoffy", name: "Shoffy" }, idle, 1000)
    expect(presence.list("t2", 1000)).toEqual([])
  })

  it("replaces what someone was doing with what they do now", () => {
    const presence = createPresence()
    presence.touch("t1", { id: "shoffy", name: "Shoffy" }, { variantId: "v1", playerId: "anna", typing: null }, 1000)
    presence.touch("t1", { id: "shoffy", name: "Shoffy" }, idle, 1500)
    expect(presence.list("t1", 1600)).toEqual([{ userId: "shoffy", name: "Shoffy", activity: idle }])
  })
})
