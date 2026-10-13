import { describe, expect, it } from "vitest"
import { groupByYear } from "./tournament-list"

const t = (name: string, startDate: string | null, createdAt = "2020-01-01") => ({ name, startDate: startDate ? new Date(startDate) : null, createdAt: new Date(createdAt) })

describe("groupByYear", () => {
  it("puts the tournaments under the year they start in, the latest year first, in their order", () => {
    const groups = groupByYear([t("Blitz", "2026-09-20"), t("Vertigo", "2026-06-07"), t("7CC", "2025-11-09"), t("EMC", "2024-09-22"), t("MTS", "2024-05-12")])
    expect(groups.map((g) => [g.year, g.tournaments.map((x) => x.name)])).toEqual([
      [2026, ["Blitz", "Vertigo"]],
      [2025, ["7CC"]],
      [2024, ["EMC", "MTS"]],
    ])
  })

  it("takes the year a tournament without a start date was entered in", () => {
    const groups = groupByYear([t("Dated", "2025-03-01"), t("Undated", null, "2026-02-01"), t("Old", "2024-01-15")])
    expect(groups.map((g) => [g.year, g.tournaments.map((x) => x.name)])).toEqual([
      [2026, ["Undated"]],
      [2025, ["Dated"]],
      [2024, ["Old"]],
    ])
  })

  it("is empty without tournaments", () => {
    expect(groupByYear([])).toEqual([])
  })
})
