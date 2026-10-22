import { describe, expect, it } from "vitest"
import { checkTotals, parseNames, planSummaryImport, summaryWarnings } from "./summary-import"

const names = parseNames([
  "name\ttmId\tplayer\tfrom\tuntil",
  "Sebi\ttm-sebi\tLPNSebi",
  "Rain\ttm-rain\tRainbow",
  "s0nity\ttm-sonity\ts0nity",
  "Gast\t-\t(result left out)",
].join("\n"))

const HEAD = "team\tstage\tmatch\topponent\tdate\tsub\tformat\tmap\twon\tlost\toutcome\tscreenshot\tname\trounds\tplaces"
const file = (...rows: string[]) => ["# comp: Vertigo S1", "", "## matches", HEAD, ...rows].join("\n")

describe("planSummaryImport", () => {
  it("groups the lines of a screenshot into matches and sub-matches", () => {
    const plan = planSummaryImport(file(
      "B2 Rising\tMD1\t1\tOnyx White\t2026-06-14\t1\t1v1\t\t3\t7\tL\t1521285239257825361_0\ts0nity\t\t",
      "B2 Rising\tMD1\t1\tOnyx White\t2026-06-14\t2\t2v2\t\t2\t5\tL\t1521285239257825361_0\tSebi\t9\t26",
      "B2 Rising\tMD1\t1\tOnyx White\t2026-06-14\t2\t2v2\t\t2\t5\tL\t1521285239257825361_0\tRain\t9\t24",
    ), names)

    expect(plan.errors).toEqual([])
    expect(plan.comp).toBe("Vertigo S1")
    expect(plan.matches).toHaveLength(1)
    const [match] = plan.matches
    expect(match).toMatchObject({ team: "B2 Rising", stage: { type: "GROUP", number: 1 }, number: 1, opponent: "Onyx White", date: "2026-06-14" })
    expect(match.subMatches.map((sm) => ({ ...sm, players: sm.players.map((p) => [p.tmId, p.rounds, p.placementSum]) }))).toEqual([
      {
        order: 1, format: "ROUND_1V1", track: null, rounds: 10, roundsWon: 3, roundsLost: 7, outcome: "L",
        sourceUrl: "https://discord.com/channels/733887691258593280/1060207503046082592/1521285239257825361", sourceImage: "1521285239257825361_0",
        // A 1v1 without places on the screenshot: every round won is a first, every round lost a second place
        players: [["tm-sonity", 10, 17]],
      },
      {
        order: 2, format: "ROUND_2V2", track: null, rounds: 9, roundsWon: 2, roundsLost: 5, outcome: "L",
        sourceUrl: "https://discord.com/channels/733887691258593280/1060207503046082592/1521285239257825361", sourceImage: "1521285239257825361_0",
        players: [["tm-sebi", 9, 26], ["tm-rain", 9, 24]],
      },
    ])
  })

  it("takes a sub-match given in points instead of places for the record only, keeping the points", () => {
    const plan = planSummaryImport([
      "# comp: FSM S1", "", "## matches", `${HEAD}\tpoints`,
      "B2 eSports\tMD2\t1\tTeamNL\t2025-03-30\t2\t2v2\tSzimpla\t1\t5\tL\t1355962953890791534_0\tSebi\t6\t\t3",
      "B2 eSports\tMD2\t1\tTeamNL\t2025-03-30\t2\t2v2\tSzimpla\t1\t5\tL\t1355962953890791534_0\ts0nity\t6\t\t2",
      // A 1v1 with the rounds driven but no places: record only, too
      "B2 eSports\tMD2\t1\tTeamNL\t2025-03-30\t1\t1v1\tSzimpla\t7\t0\tW\t1355962953890791534_0\tRain\t8\t\t",
    ].join("\n"), names)

    expect(plan.errors).toEqual([])
    const [twos, ones] = plan.matches[0].subMatches
    expect(twos.players).toEqual([
      { name: "Sebi", tmId: "tm-sebi", rounds: 6, placementSum: null, points: 3 },
      { name: "s0nity", tmId: "tm-sonity", rounds: 6, placementSum: null, points: 2 },
    ])
    expect(ones.rounds).toBe(8)
    expect(ones.players).toEqual([{ name: "Rain", tmId: "tm-rain", rounds: 8, placementSum: null, points: null }])
  })
})

describe("planSummaryImport: checks", () => {
  const row = (name: string, rounds: string, places: string, extra: { outcome?: string; won?: string; lost?: string; opponent?: string; date?: string } = {}) =>
    `B2 Rising\tMD1\t1\t${extra.opponent ?? "Onyx White"}\t${extra.date ?? "2026-06-14"}\t1\t2v2\t\t${extra.won ?? "2"}\t${extra.lost ?? "5"}\t${extra.outcome ?? "L"}\t1521285239257825361_0\t${name}\t${rounds}\t${places}`

  it("names a screenshot name that is not in the list", () => {
    expect(planSummaryImport(file(row("Toast", "9", "26")), names).errors).toEqual([`line 5: name "Toast" is not in the name list`])
  })

  it("leaves out the results of a name Felix decided to drop", () => {
    const plan = planSummaryImport(file(row("Sebi", "9", "26"), row("Gast", "9", "24")), names)
    expect(plan.errors).toEqual([])
    expect(plan.matches[0].subMatches[0].players.map((p) => p.tmId)).toEqual(["tm-sebi"])
  })

  it("resolves a nickname by the day of the match and asks when it is ambiguous", () => {
    const dated = parseNames(["name\ttmId\tplayer\tfrom\tuntil", "Toast\ttm-a\tA\t\t2025-12-31", "Toast\ttm-b\tB\t2026-01-01\t", "Ente\ttm-c\tC", "Ente\ttm-d\tD"].join("\n"))
    const plan = planSummaryImport(file(row("Toast", "9", "26"), row("Ente", "9", "24")), dated)
    expect(plan.matches[0].subMatches[0].players.map((p) => p.tmId)).toEqual(["tm-b"])
    expect(plan.errors).toEqual([`line 6: name "Ente" stands for several players on 2026-06-14`])
  })

  it("rejects places that cannot be: below one or beyond the last place per round", () => {
    const plan = planSummaryImport(file(row("Sebi", "9", "8"), row("Rain", "9", "37")), names)
    expect(plan.errors).toEqual([
      "line 5: 8 places in 9 rounds is less than first place every round",
      "line 6: 37 places in 9 rounds is more than last place (4) every round",
    ])
  })

  it("rejects a result that contradicts the outcome", () => {
    expect(planSummaryImport(file(row("Sebi", "9", "26", { won: "5", lost: "2", outcome: "L" })), names).errors).toEqual(["line 5: 5:2 does not fit outcome L"])
  })

  it("rejects a player listed twice in a sub-match", () => {
    expect(planSummaryImport(file(row("Sebi", "9", "26"), row("sebi", "9", "26")), names).errors).toEqual(["line 6: LPNSebi (tm-sebi) is listed twice in this sub-match"])
  })

  it("rejects lines of one match that disagree on the opponent, the day or the result", () => {
    const plan = planSummaryImport(file(row("Sebi", "9", "26"), row("Rain", "9", "24", { opponent: "Onyx Black", won: "3" })), names)
    expect(plan.errors).toEqual(["line 6: opponent differs from the match's first line", "line 6: won differs from the sub-match's first line"])
  })
})

describe("summaryWarnings", () => {
  it("names sub-matches whose rounds do not add up to a full team", () => {
    const plan = planSummaryImport(file(
      "B2 Rising\tMD1\t1\tOnyx\t2026-06-14\t1\t2v2\t\t2\t5\tL\t1_0\tSebi\t9\t26",
      "B2 Rising\tMD1\t1\tOnyx\t2026-06-14\t2\t2v2\t\t2\t5\tL\t1_0\tSebi\t9\t26",
      "B2 Rising\tMD1\t1\tOnyx\t2026-06-14\t2\t2v2\t\t2\t5\tL\t1_0\tRain\t9\t24",
    ), names)
    expect(summaryWarnings(plan)).toEqual(["B2 Rising MD1 #1 sub 1 (2v2): 9 player rounds, a full team drives 18"])
  })
})

describe("checkTotals", () => {
  const TOTALS = "team\tstages\tformat\tname\trounds\tplaces\tscreenshot"
  const matches = [
    "B2 Rising\tMD1\t1\tOnyx\t2026-06-14\t1\t2v2\t\t2\t5\tL\t1_0\tSebi\t9\t26",
    "B2 Rising\tMD1\t1\tOnyx\t2026-06-14\t1\t2v2\t\t2\t5\tL\t1_0\tRain\t9\t24",
    "B2 Rising\tMD1\t2\tLine\t2026-06-14\t1\t2v2\t\t2\t5\tL\t1_0\tSebi\t10\t28",
    "B2 Rising\tMD1\t2\tLine\t2026-06-14\t1\t2v2\t\t2\t5\tL\t1_0\tRain\t10\t26",
    "B2 Rising\tMD2\t1\tCoco\t2026-06-21\t1\t2v2\t\t2\t5\tL\t2_0\tSebi\t10\t20",
  ]
  const withTotals = (...totals: string[]) => file(...matches, "", "## totals", TOTALS, ...totals)

  it("finds nothing when the matches add up to the total table", () => {
    const plan = planSummaryImport(withTotals("B2 Rising\tMD1\t2v2\tSebi\t19\t54\t3_0", "B2 Rising\tMD1\t2v2\tRain\t19\t50\t3_0"), names)
    expect(plan.errors).toEqual([])
    expect(checkTotals(plan)).toEqual([])
  })

  it("names every player whose sum differs and every player missing in the total", () => {
    const plan = planSummaryImport(withTotals("B2 Rising\t*\t2v2\tSebi\t29\t75\t3_0"), names)
    expect(checkTotals(plan)).toEqual([
      "B2 Rising * 2v2 Sebi (line 13): total 29 rounds / 75 places, matches 29 / 74",
      "B2 Rising * 2v2 Rain: 19 rounds / 50 places in the matches, not in the total (screenshot 3_0)",
    ])
  })

  it("checks a total given in points against the points of the matches", () => {
    const plan = planSummaryImport([
      "# comp: FSM S1", "", "## matches", `${HEAD}\tpoints`,
      "B2 eSports\tMD1\t1\tSzimpla\t2025-03-23\t1\t2v2\t\t5\t2\tW\t1_0\tSebi\t7\t\t20",
      "B2 eSports\tMD2\t1\tTeamNL\t2025-03-30\t1\t2v2\t\t1\t5\tL\t2_0\tSebi\t6\t\t3",
      "", "## totals", "team\tstages\tformat\tname\trounds\tplaces\tpoints\tscreenshot",
      "B2 eSports\t*\t2v2\tSebi\t13\t\t24\t3_0",
    ].join("\n"), names)
    expect(plan.errors).toEqual([])
    expect(checkTotals(plan)).toEqual(["B2 eSports * 2v2 Sebi (line 10): total 13 rounds / 24 points, matches 13 / 23"])
  })
})
