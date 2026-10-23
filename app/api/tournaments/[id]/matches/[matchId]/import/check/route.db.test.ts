import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema; who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { POST } from "./route"

describe.skipIf(process.env.DB_TESTS !== "1")("import check against the matchday planning with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  let ids: { comp: string; match: string }
  const anna = { tmId: "anna-tm", name: "Anna" }, ben = { tmId: "ben-tm", name: "Ben" }, cleo = { tmId: "cleo-tm", name: "Cleo" }
  beforeAll(async () => {
    process.env.MATCHDAY_PLANNING = "on"
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client

    const player = (p: { tmId: string; name: string }) => client.player.create({ data: { name: p.name, initialName: p.name, tmId: p.tmId } })
    const [a, b, c] = [await player(anna), await player(ben), await player(cleo)]
    const comp = await client.tournament.create({ data: { name: "Comp", formats: ["ROUND_1V1", "ROUND_2V2"], style: "MIXED", stages: { create: { type: "GROUP", number: 1 } } }, include: { stages: true } })
    const lineup = await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "A", slots: { create: [{ playerId: a.id }, { playerId: b.id }, { playerId: c.id }] } } })
    const match = await client.match.create({ data: { tournamentId: comp.id, tournamentLineupId: lineup.id, stageId: comp.stages[0].id, subMatches: { create: [{ format: "ROUND_1V1", order: 1 }, { format: "ROUND_2V2", order: 2 }] } } })
    const day = { ROUND_1V1: [a.id], ROUND_2V2: [a.id, b.id] }
    await client.matchdayPlan.create({ data: { lineupId: lineup.id, stageId: comp.stages[0].id, published: { day, matches: { [match.id]: day } }, publishedAt: new Date() } })
    ids = { comp: comp.id, match: match.id }
  }, 30000)
  afterAll(async () => { delete process.env.MATCHDAY_PLANNING; await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const check = async (body: unknown) => (await POST(new Request("http://test/check", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: ids.comp, matchId: ids.match }) })).json()
  const sides = { ours: [anna, cleo], foreign: [], driven: [{ format: "ROUND_1V1", drivers: [anna] }, { format: "ROUND_2V2", drivers: [anna, cleo] }] }

  it("names where the import differs from the finalised lineup, apart from the hints to confirm", async () => {
    state.session = { user: { id: "admin", role: "ADMIN" } }
    const result = await check(sides)
    expect(result.planDeviations).toEqual(["2v2: planned Ben, driven Cleo"])
    expect(result.hints).toEqual([])
  })

  it("compares nothing while the planning is switched off", async () => {
    state.session = { user: { id: "admin", role: "ADMIN" } }
    process.env.MATCHDAY_PLANNING = "off"
    expect((await check(sides)).planDeviations).toEqual([])
    process.env.MATCHDAY_PLANNING = "on"
  })
})
