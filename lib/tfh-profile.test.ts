import { expect, it } from "vitest"
import { summarizeTfhProfile, formatTfhDuration, formatTfhElapsed } from "./tfh-profile"

it("counts distinct races, sums supplied seconds and exposes missing play time without inventing a value", () => {
  expect(summarizeTfhProfile([{ raceId: "24", playTimeSeconds: 26315 }, { raceId: "12", playTimeSeconds: 16267 }, { raceId: "12", playTimeSeconds: null }])).toEqual({ participations: 2, playTimeSeconds: 42582, missingPlayTimes: 1 })
  expect(formatTfhDuration(26315)).toBe("7h 18m 35s")
  expect(formatTfhDuration(null)).toBe("—")
})

it("formats checkpoint elapsed time in hours while preserving milliseconds", () => {
  expect(formatTfhElapsed(86395531)).toBe("23:59:55.531")
  expect(formatTfhElapsed(null)).toBe("—")
})
