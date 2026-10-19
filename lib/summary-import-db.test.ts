import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"
import { importSummary } from "./summary-import-db"
import { parseNames, planSummaryImport } from "./summary-import"

describe.skipIf(process.env.DB_TESTS !== "1")("summary import with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `summary_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    for (const [tmId, name] of [["tm-sebi", "LPNSebi"], ["tm-rain", "Rainbow"], ["tm-sonity", "s0nity"]]) {
      await client.player.create({ data: { tmId, name, initialName: name } })
    }
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const names = parseNames(["name\ttmId\tplayer", "Sebi\ttm-sebi\tLPNSebi", "Rain\ttm-rain\tRainbow", "s0nity\ttm-sonity\ts0nity"].join("\n"))
  const HEAD = "team\tstage\tmatch\topponent\tdate\tsub\tformat\tmap\twon\tlost\toutcome\tscreenshot\tname\trounds\tplaces"
  const plan = (comp: string, meta: string[], ...rows: string[]) => planSummaryImport([`# comp: ${comp}`, ...meta, "## matches", HEAD, ...rows].join("\n"), names)
  const newComp = ["# create: yes", "# start: 2025-02-10", "# end: 2025-03-09", "# formats: 1v1,2v2", "# style: FULLSPEED"]
  const rows = [
    "B2 Rising\tMD1\t1\tOnyx White\t2025-02-16\t1\t1v1\t\t3\t7\tL\t111_0\ts0nity\t\t",
    "B2 Rising\tMD1\t1\tOnyx White\t2025-02-16\t2\t2v2\tRoquende\t2\t5\tL\t111_0\tSebi\t9\t26",
    "B2 Rising\tMD1\t1\tOnyx White\t2025-02-16\t2\t2v2\tRoquende\t2\t5\tL\t111_0\tRain\t9\t24",
  ]

  it("creates a missing comp with its lineup, roster, stage and summary matches", async () => {
    const report = await importSummary(plan("SMS S1", newComp, ...rows), client)
    expect(report.kept).toEqual([])
    const comp = await client.tournament.findFirstOrThrow({
      where: { name: "SMS S1" },
      include: {
        stages: true,
        tournamentLineups: { include: { slots: { include: { player: true } } } },
        matches: { include: { subMatches: { orderBy: { order: "asc" }, include: { lineup: { include: { slots: true } }, summary: { include: { players: { include: { player: true } } } } } } } },
      },
    })
    expect(comp).toMatchObject({ formats: ["ROUND_1V1", "ROUND_2V2"], style: "FULLSPEED", stages: [{ type: "GROUP", number: 1 }] })
    expect(comp.startDate?.toISOString().slice(0, 10)).toBe("2025-02-10")
    expect(comp.tournamentLineups).toHaveLength(1)
    expect(comp.tournamentLineups[0].name).toBe("B2 Rising")
    expect(comp.tournamentLineups[0].slots.map((s) => s.player.name).sort()).toEqual(["LPNSebi", "Rainbow", "s0nity"])
    expect(comp.matches).toHaveLength(1)
    const [match] = comp.matches
    expect(match).toMatchObject({ opponent: "Onyx White", number: 1, tournamentLineupId: comp.tournamentLineups[0].id })
    expect(match.subMatches[1]).toMatchObject({ format: "ROUND_2V2", summary: { track: "Roquende", rounds: 9, roundsWon: 2, roundsLost: 5, outcome: "L", sourceImage: "111_0" } })
    expect(match.subMatches[1].summary!.players.map((p) => [p.player.name, p.rounds, p.placementSum])).toEqual([["LPNSebi", 9, 26], ["Rainbow", 9, 24]])
    expect(match.subMatches[1].lineup!.slots).toHaveLength(2)
  })

  it("replaces the summary matches of the comp when the file is imported again", async () => {
    await importSummary(plan("SMS S1", newComp, rows[0]), client)
    const matches = await client.match.findMany({ where: { tournament: { name: "SMS S1" } }, include: { subMatches: true } })
    expect(matches).toHaveLength(1)
    expect(matches[0].subMatches).toHaveLength(1)
  })

  it("keeps a match that has round results and only reports it for the comparison", async () => {
    const comp = await client.tournament.create({ data: { name: "Vertigo S1", formats: ["ROUND_2V2"], style: "TECH", stages: { create: { type: "GROUP", number: 1 } } }, include: { stages: true } })
    const lineup = await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "B2 Rising" } })
    await client.match.create({
      data: {
        tournamentId: comp.id, tournamentLineupId: lineup.id, stageId: comp.stages[0].id, opponent: "onyx white", number: 1,
        subMatches: { create: { format: "ROUND_2V2", order: 0, rounds: { create: { number: 1, results: { create: { tmId: "tm-sebi", playerName: "Sebi", isOurTeam: true, position: 1 } } } } } },
      },
    })
    const report = await importSummary(plan("Vertigo S1", [], ...rows.slice(1)), client)
    expect(report.kept).toEqual(["B2 Rising MD1 #1"])
    const matches = await client.match.findMany({ where: { tournamentId: comp.id }, include: { subMatches: { include: { summary: true } } } })
    expect(matches).toHaveLength(1)
    expect(matches[0].subMatches[0].summary).toBeNull()
  })

  it("refuses an unknown comp that is not marked for creation and a player that does not exist", async () => {
    await expect(importSummary(plan("Nowhere", [], ...rows), client)).rejects.toThrow(`Comp "Nowhere" not found`)
    const ghost = planSummaryImport(["# comp: SMS S1", "## matches", HEAD, "B2 Rising\tMD1\t1\tX\t\t1\t2v2\t\t\t\tW\t1_0\tGhost\t9\t20"].join("\n"), parseNames("name\ttmId\tplayer\nGhost\ttm-ghost\tGhost"))
    await expect(importSummary(ghost, client)).rejects.toThrow("No player with tmId tm-ghost")
  })
})
