import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The routes run against a temporary PostgreSQL schema; only who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { POST } from "./route"
import { PATCH } from "./[id]/route"

describe.skipIf(process.env.DB_TESTS !== "1")("style of a tournament with PostgreSQL", () => {
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

  const comp = (extra: object) => ({ name: `Comp ${crypto.randomUUID()}`, formats: ["ROUND_3V3"], startDate: "2026-10-01", ...extra })
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

  it("refuses an unknown style or none on a change", async () => {
    const { id } = await (await post(comp({ style: "TECH" }))).json()
    expect((await patch(id, { style: "SNOW" })).status).toBe(400)
    expect((await patch(id, { style: null })).status).toBe(400)
    expect(await stored(id)).toBe("TECH")
  })
})
