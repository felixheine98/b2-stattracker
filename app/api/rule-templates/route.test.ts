import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The routes run against a temporary PostgreSQL schema; only who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { GET, POST } from "./route"
import { DELETE, PATCH } from "./[id]/route"

describe.skipIf(process.env.DB_TESTS !== "1")("rule templates with PostgreSQL", () => {
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

  const mts = {
    formats: ["ROUND_1V1", "ROUND_3V3", "ROUND_3V3"],
    rules: { flow: "DECIDER", formatRules: { ROUND_1V1: { roundsToWin: 7, maxRounds: null }, ROUND_3V3: { roundsToWin: 7, maxRounds: 13 } }, points: { win: 3, draw: 1, loss: 0 } },
    playoffRules: { formats: ["ROUND_3V3", "ROUND_3V3", "ROUND_3V3"], flow: "UNTIL_DECIDED", formatRules: { ROUND_3V3: { roundsToWin: 5, maxRounds: null } } },
  }
  const post = (body: unknown) => POST(new Request("http://test/api/rule-templates", { method: "POST", body: JSON.stringify(body) }))
  const patch = (id: string, body: unknown) => PATCH(new Request("http://test", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
  const list = async () => (await GET()).json() as Promise<Array<{ id: string; name: string; formats: string[]; rules: unknown; playoffRules: unknown }>>
  const unique = () => `Template ${crypto.randomUUID()}`

  it("saves a template under a name and lists it with everything it holds", async () => {
    const name = unique()
    const res = await post({ name, ...mts })
    expect(res.status).toBe(201)
    const found = (await list()).find((t) => t.name === name)
    expect(found).toMatchObject(mts)
  })

  it("lists the templates by name", async () => {
    await post({ name: "zz last", ...mts }); await post({ name: "AA first", ...mts })
    const names = (await list()).map((t) => t.name)
    expect(names.indexOf("AA first")).toBeLessThan(names.indexOf("zz last"))
  })

  it("refuses a template without a name or with incomplete rules", async () => {
    expect((await (await post({ name: "  ", ...mts })).json()).error).toBe("Enter a name for the template")
    const noTarget = await post({ name: unique(), ...mts, rules: { ...mts.rules, formatRules: {} } })
    expect(noTarget.status).toBe(400)
    expect((await noTarget.json()).error).toBe("Enter the rounds to win for 1v1")
    const playoff = await post({ name: unique(), ...mts, playoffRules: { ...mts.playoffRules, flow: null } })
    expect((await playoff.json()).error).toBe("Playoffs: Select how a match is decided")
  })

  it("only replaces a template of the same name when told to", async () => {
    const name = unique()
    await post({ name, ...mts })
    const again = await post({ name, ...mts, playoffRules: null })
    expect(again.status).toBe(409)
    expect((await list()).find((t) => t.name === name)?.playoffRules).toEqual(mts.playoffRules)
    expect((await post({ name, ...mts, playoffRules: null, overwrite: true })).status).toBe(201)
    const found = (await list()).filter((t) => t.name === name)
    expect(found).toHaveLength(1)
    expect(found[0].playoffRules).toBeNull()
  })

  it("renames and changes a template", async () => {
    const { id } = await (await post({ name: unique(), ...mts })).json()
    const name = unique()
    expect((await patch(id, { name })).status).toBe(200)
    expect((await list()).find((t) => t.id === id)).toMatchObject({ name, ...mts })
    const changed = { ...mts, formats: ["ROUND_3V3", "ROUND_3V3"], rules: { ...mts.rules, flow: "ALL" } }
    expect((await patch(id, changed)).status).toBe(200)
    // The rule of the format that left the sequence is gone
    expect((await list()).find((t) => t.id === id)).toMatchObject({ name, formats: changed.formats, rules: { flow: "ALL", formatRules: { ROUND_3V3: mts.rules.formatRules.ROUND_3V3 } } })
    expect((await patch(id, { rules: { ...mts.rules, flow: null } })).status).toBe(400)
  })

  it("refuses a name another template has", async () => {
    const taken = unique()
    await post({ name: taken, ...mts })
    const { id } = await (await post({ name: unique(), ...mts })).json()
    const res = await patch(id, { name: taken })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe("There is already a template with this name")
  })

  it("deletes a template", async () => {
    const { id } = await (await post({ name: unique(), ...mts })).json()
    expect((await DELETE(new Request("http://test", { method: "DELETE" }), { params: Promise.resolve({ id }) })).status).toBe(200)
    expect((await list()).some((t) => t.id === id)).toBe(false)
  })

  it("is for admins and managers only", async () => {
    state.session = { user: { id: "player", role: "PLAYER" } }
    try {
      expect((await GET()).status).toBe(403)
      expect((await post({ name: unique(), ...mts })).status).toBe(403)
    } finally { state.session = { user: { id: "user", role: "MANAGER" } } }
  })
})
