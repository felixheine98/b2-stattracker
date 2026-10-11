import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { blockDrivers, parseMatchCsv, planBlock, suspiciousRounds } from "./match-csv"

// A real dump of a whole match: three maps of 3v3, with a stray round at the start of two of them
const dump = readFileSync(new URL("./fixtures/match-dump-3v3.csv", import.meta.url), "utf8")

const FLONKO = "6fc2c2ca-2b3a-4290-8451-99ebf58d88ab"
const JAN = "301b6b68-f694-49dc-88c3-80fcc2cfc0c1"
const BETATOAST = "ac935c32-4986-4af7-ac4d-ab4314101bc1"
const ROQUETT = "6cdffc9d-5773-4ffd-a1f4-5ebb4e3b048a"

const HEADER = "Time,Track,PlayerID,PlayerName,Record,RoundNumber,RoundID"
// Rows as "time track player record round [roundId]"
function csv(...rows: string[]) {
  return [HEADER, ...rows.map((row) => {
    const [time, track, player, record, round, roundId = ""] = row.split(" ")
    return `${time},${track},id-${player},${player},${record},${round},${roundId}`
  })].join("\n")
}

describe("parseMatchCsv", () => {
  it("splits a whole match into one block per map", () => {
    const blocks = parseMatchCsv([dump])
    expect(blocks.map((b) => [b.track, b.rounds.length])).toEqual([
      ["BLTZ - Sticks&Fire", 13],
      ["BLTZ - Palmotropico ft Thounej", 7],
      ["BLTZ - Siracusa", 14],
    ])
  })

  it("lists the drivers of a round in finishing order", () => {
    const [block] = parseMatchCsv([dump])
    expect(block.rounds[1].entries.map((e) => e.name)).toEqual(["Flonko", "Jan_08.", "Roquett", "ryuhax_", "MW.Raistlin", "Betatoast2"])
    expect(block.rounds[1].entries[0]).toMatchObject({ tmId: FLONKO, timeMs: 58765 })
  })

  it("starts a new block when the round number goes back on the same map", () => {
    const blocks = parseMatchCsv([csv("10 A anna 60000 1", "10 A opp 61000 1", "20 A anna 60000 2", "20 A opp 61000 2", "30 A anna 60000 1", "30 A ben 60500 1", "30 A opp 61000 1", "30 A opq 62000 1")])
    expect(blocks.map((b) => b.rounds.length)).toEqual([2, 1])
  })

  it("puts several files in the order they were driven, each starting a block", () => {
    const later = csv("200 A anna 60000 1", "200 A opp 61000 1")
    const earlier = csv("100 A anna 60000 1", "100 A opp 61000 1", "110 A anna 60000 2", "110 A opp 61000 2")
    expect(parseMatchCsv([later, earlier]).map((b) => b.rounds.length)).toEqual([2, 1])
  })

  it("drops a round that a second file repeats", () => {
    const first = csv("100 A anna 60000 1 r-1", "100 A opp 61000 1 r-1")
    const second = csv("100 A anna 60000 1 r-1", "100 A opp 61000 1 r-1", "110 A anna 60000 2 r-2", "110 A opp 61000 2 r-2")
    expect(parseMatchCsv([first, second]).flatMap((b) => b.rounds.map((r) => r.number))).toEqual([1, 2])
  })

  it("reads a record of zero or less as not finished", () => {
    const [block] = parseMatchCsv([csv("10 A anna 60000 1", "10 A opp -1 1")])
    expect(block.rounds[0].entries).toMatchObject([{ name: "anna", timeMs: 60000 }, { name: "opp", timeMs: null }])
  })

  it("rejects a file without the needed columns", () => {
    expect(() => parseMatchCsv(["Time,Track\n1,A"])).toThrow()
  })
})

describe("suspiciousRounds", () => {
  it("picks the incomplete first round of a block and rounds with less than half the drivers", () => {
    const blocks = parseMatchCsv([dump])
    const picked = blocks.map((b) => [...suspiciousRounds(b, 3).keys()].map((key) => b.rounds.find((r) => r.key === key)!.number))
    expect(picked).toEqual([[0], [], [1]])
  })

  it("keeps a round that only misses a driver who did not finish", () => {
    const [block] = parseMatchCsv([dump])
    const last = block.rounds.at(-1)!
    expect(last.entries).toHaveLength(5)
    expect(suspiciousRounds(block, 3).has(last.key)).toBe(false)
  })

  it("says why a round was picked", () => {
    const [block] = parseMatchCsv([dump])
    expect([...suspiciousRounds(block, 3).values()][0]).toContain("2 von 6")
  })
})

describe("planBlock", () => {
  const [block] = parseMatchCsv([dump])
  const kept = new Set(block.rounds.filter((r) => !suspiciousRounds(block, 3).has(r.key)).map((r) => r.key))

  it("sorts the drivers into ours and theirs", () => {
    const plan = planBlock(block, kept, new Set([FLONKO, JAN, BETATOAST]), 3)
    expect(plan.ours.map((d) => d.name).sort()).toEqual(["Betatoast2", "Flonko", "Jan_08."])
    expect(plan.theirs.map((d) => d.name).sort()).toEqual(["MW.Raistlin", "Roquett", "ryuhax_"])
    expect(plan.warnings).toEqual([])
    expect(plan.rounds).toHaveLength(12)
  })

  it("adds a driver who is missing in a round as not finished, on the last place", () => {
    const plan = planBlock(block, kept, new Set([FLONKO, JAN, BETATOAST]), 3)
    const last = plan.rounds.at(-1)!
    expect(last.results).toHaveLength(6)
    expect(last.results.at(-1)).toMatchObject({ tmId: ROQUETT, dnf: true, timeMs: null, isOurTeam: false })
    expect(last.dnfs).toEqual(["Roquett"])
    expect(plan.rounds[0].dnfs).toEqual([])
  })

  it("warns when the sides do not fit the format and then adds nobody to the larger side", () => {
    const plan = planBlock(block, kept, new Set([FLONKO, JAN]), 3)
    expect(plan.warnings).toHaveLength(2)
    expect(plan.rounds.at(-1)!.results).toHaveLength(5)
  })

  it("leaves out the rounds that are not selected", () => {
    const plan = planBlock(block, new Set([block.rounds[1].key]), new Set([FLONKO, JAN, BETATOAST]), 3)
    expect(plan.rounds).toHaveLength(1)
  })
})

describe("blockDrivers", () => {
  it("counts the rounds of everyone in a block", () => {
    const [block] = parseMatchCsv([dump])
    expect(blockDrivers(block).find((d) => d.tmId === JAN)).toMatchObject({ name: "Jan_08.", rounds: 12 })
  })
})
