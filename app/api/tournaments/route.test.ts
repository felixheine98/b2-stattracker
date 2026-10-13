import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The routes run against a temporary PostgreSQL schema; only who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { POST } from "./route"
import { PATCH } from "./[id]/route"
import { POST as POST_MATCH } from "./[id]/matches/route"

describe.skipIf(process.env.DB_TESTS !== "1")("tournament routes with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client
    state.session = { user: { id: "user", role: "MANAGER" } }
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const rules = { flow: "ALL", formatRules: { ROUND_3V3: { roundsToWin: 7, maxRounds: null } }, points: { win: 3, draw: 1, loss: 0 } }
  const comp = (extra: object) => ({ name: `Comp ${crypto.randomUUID()}`, formats: ["ROUND_3V3"], startDate: "2026-10-01", rules, ...extra })
  const post = (body: unknown) => POST(new Request("http://test/api/tournaments", { method: "POST", body: JSON.stringify(body) }))
  const patch = (id: string, body: unknown) => PATCH(new Request("http://test/api/tournaments/x", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
  const stored = async (id: string) => (await client.tournament.findUniqueOrThrow({ where: { id } })).style

  it("creates a tournament with the chosen style", async () => {
    const res = await post(comp({ style: "ICE" }))
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created.style).toBe("ICE")
    expect(await stored(created.id)).toBe("ICE")
  })

  it("refuses a new tournament without a style or with an unknown one", async () => {
    const before = await client.tournament.count()
    const missing = await post(comp({}))
    expect(missing.status).toBe(400)
    expect((await missing.json()).error).toBe("Select a style")
    expect((await post(comp({ style: "SNOW" }))).status).toBe(400)
    expect(await client.tournament.count()).toBe(before)
  })

  it("changes the style of a tournament and leaves it alone otherwise", async () => {
    const { id } = await (await post(comp({ style: "TECH" }))).json()
    expect((await patch(id, { description: "new" })).status).toBe(200)
    expect(await stored(id)).toBe("TECH")
    const changed = await patch(id, { style: "MIXED" })
    expect(changed.status).toBe(200)
    expect((await changed.json()).style).toBe("MIXED")
    expect(await stored(id)).toBe("MIXED")
  })

  it("creates an endurance tournament without formats, which only the others need", async () => {
    const res = await post({ ...comp({ style: "ENDURANCE" }), formats: [] })
    expect(res.status).toBe(201)
    expect((await client.tournament.findUniqueOrThrow({ where: { id: (await res.json()).id } })).formats).toEqual([])
    const refused = await post({ ...comp({ style: "TECH" }), formats: [] })
    expect(refused.status).toBe(400)
    expect((await refused.json()).error).toBe("Select at least one format")
  })

  it("lets only an endurance tournament drop its formats on a change", async () => {
    const formats = async (id: string) => (await client.tournament.findUniqueOrThrow({ where: { id } })).formats
    const endurance = (await (await post(comp({ style: "ENDURANCE" }))).json()).id
    expect((await patch(endurance, { formats: [] })).status).toBe(200)
    expect(await formats(endurance)).toEqual([])
    // Without formats it cannot become a tournament of another style
    expect((await patch(endurance, { style: "TECH" })).status).toBe(400)
    expect(await stored(endurance)).toBe("ENDURANCE")
    expect((await patch(endurance, { style: "TECH", formats: ["ROUND_1V1"], rules: { ...rules, formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null } } } })).status).toBe(200)

    const tech = (await (await post(comp({ style: "TECH" }))).json()).id
    expect((await patch(tech, { formats: [] })).status).toBe(400)
    expect(await formats(tech)).toEqual(["ROUND_3V3"])
    expect((await patch(tech, { style: "ENDURANCE", formats: [] })).status).toBe(200)
  })

  it("refuses an unknown style or none on a change", async () => {
    const { id } = await (await post(comp({ style: "TECH" }))).json()
    expect((await patch(id, { style: "SNOW" })).status).toBe(400)
    expect((await patch(id, { style: null })).status).toBe(400)
    expect(await stored(id)).toBe("TECH")
  })

  describe("format rules", () => {
    const mts = {
      formats: ["ROUND_1V1", "ROUND_2V2", "ROUND_3V3", "ROUND_3V3", "ROUND_3V3"],
      rules: {
        flow: "DECIDER",
        formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null }, ROUND_2V2: { roundsToWin: 7, maxRounds: 13 }, ROUND_3V3: { roundsToWin: 7, maxRounds: null } },
        points: { win: 3, draw: 1, loss: 0 },
      },
    }
    const playoffRules = { formats: ["ROUND_3V3", "ROUND_3V3", "ROUND_3V3"], flow: "UNTIL_DECIDED", formatRules: { ROUND_3V3: { roundsToWin: 5, maxRounds: null } } }
    const read = async (id: string) => (await patch(id, {})).json()

    it("creates a tournament with its rule set and gives it back", async () => {
      const res = await post(comp({ style: "TECH", ...mts }))
      expect(res.status).toBe(201)
      const created = await res.json()
      expect(created.rules).toEqual(mts.rules)
      expect(created.playoffRules).toBeNull()
      expect((await read(created.id)).rules).toEqual(mts.rules)
    })

    it("refuses a new tournament with formats but without complete rules", async () => {
      const before = await client.tournament.count()
      const missing = await post({ ...comp({ style: "TECH" }), rules: undefined })
      expect(missing.status).toBe(400)
      expect((await missing.json()).error).toBe("Enter the match rules")
      const noFlow = await post(comp({ style: "TECH", rules: { ...rules, flow: null } }))
      expect((await noFlow.json()).error).toBe("Select how a match is decided")
      const noTarget = await post(comp({ style: "TECH", ...mts, rules: { ...mts.rules, formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null } } } }))
      expect((await noTarget.json()).error).toBe("Enter the rounds to win for 2v2")
      const noPoints = await post(comp({ style: "TECH", rules: { ...rules, points: null } }))
      expect((await noPoints.json()).error).toBe("Enter the points for a win, a draw and a loss")
      expect(await client.tournament.count()).toBe(before)
    })

    it("needs no rules for a tournament without formats", async () => {
      const res = await post({ ...comp({ style: "ENDURANCE" }), formats: [], rules: undefined })
      expect(res.status).toBe(201)
      expect((await res.json()).rules).toBeNull()
    })

    it("stores a rule set of their own for the playoffs and removes it again", async () => {
      const { id } = await (await post(comp({ style: "TECH", ...mts, playoffRules }))).json()
      expect((await read(id)).playoffRules).toEqual(playoffRules)
      expect((await patch(id, { description: "x" })).status).toBe(200)
      expect((await read(id)).playoffRules).toEqual(playoffRules)
      expect((await (await patch(id, { playoffRules: null })).json()).playoffRules).toBeNull()
      expect((await read(id)).rules).toEqual(mts.rules)
    })

    it("refuses playoff rules that are incomplete", async () => {
      const res = await post(comp({ style: "TECH", ...mts, playoffRules: { ...playoffRules, formatRules: {} } }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Playoffs: Enter the rounds to win for 3v3")
    })

    it("changes the rules and drops those of formats that left the sequence", async () => {
      const { id } = await (await post(comp({ style: "TECH", ...mts }))).json()
      const changed = { ...mts.rules, flow: "ALL", points: { win: 2, draw: 1, loss: 0 } }
      const res = await patch(id, { formats: ["ROUND_1V1", "ROUND_3V3"], rules: changed })
      expect(res.status).toBe(200)
      expect((await res.json()).rules).toEqual({ ...changed, formatRules: { ROUND_1V1: mts.rules.formatRules.ROUND_1V1, ROUND_3V3: mts.rules.formatRules.ROUND_3V3 } })
    })

    it("refuses a new format in the sequence that the rules do not cover", async () => {
      const { id } = await (await post(comp({ style: "TECH" }))).json()
      const res = await patch(id, { formats: ["ROUND_3V3", "ROUND_5V5"] })
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("Enter the rounds to win for 5v5")
    })

    it("leaves a tournament from before the rules without any, until they are entered", async () => {
      const old = await client.tournament.create({ data: { name: `Old ${crypto.randomUUID()}`, formats: ["ROUND_3V3"], style: "TECH", startDate: new Date("2025-01-01") } })
      const res = await patch(old.id, { description: "still editable", formats: ["ROUND_3V3", "ROUND_3V3"] })
      expect(res.status).toBe(200)
      expect((await res.json()).rules).toBeNull()
      expect((await (await patch(old.id, { rules })).json()).rules).toEqual(rules)
    })

    it("creates a playoff match from the format sequence of the playoff rules", async () => {
      const { id } = await (await post(comp({ style: "TECH", ...mts, playoffRules, stages: { seeding: false, matchDays: 1, playoffDays: 1 } }))).json()
      const lineup = await client.tournamentLineup.create({ data: { tournamentId: id, name: "B2" } })
      const stages = await client.stage.findMany({ where: { tournamentId: id } })
      const create = async (type: string) => {
        const res = await POST_MATCH(new Request("http://test", { method: "POST", body: JSON.stringify({ stageId: stages.find((s) => s.type === type)!.id, lineupId: lineup.id, opponent: `Team ${type}` }) }), { params: Promise.resolve({ id }) })
        expect(res.status).toBe(201)
        const match = await res.json()
        return (await client.subMatch.findMany({ where: { matchId: match.id }, orderBy: { order: "asc" } })).map((sm) => sm.format)
      }
      expect(await create("GROUP")).toEqual(mts.formats)
      expect(await create("PLAYOFF")).toEqual(playoffRules.formats)
    })
  })
})
