import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema; only who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { PATCH } from "./route"

describe.skipIf(process.env.DB_TESTS !== "1")("PATCH /api/players/[id] with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const as = (role: string | null) => { state.session = role ? { user: { id: "user", role } } : null }
  const patch = (id: string, body: unknown) => PATCH(new Request("http://test/api/players/x", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
  const newPlayer = () => client.player.create({ data: { tmId: crypto.randomUUID(), name: "TraTM", initialName: "TraTM" } })
  const stored = async (id: string) => (await client.player.findUniqueOrThrow({ where: { id } })).inactive

  it("lets a manager mark a player as inactive and take that back", async () => {
    const player = await newPlayer()
    as("MANAGER")
    const marked = await patch(player.id, { inactive: true })
    expect(marked.status).toBe(200)
    expect(await marked.json()).toMatchObject({ id: player.id, inactive: true })
    expect(await stored(player.id)).toBe(true)
    expect((await patch(player.id, { inactive: false })).status).toBe(200)
    expect(await stored(player.id)).toBe(false)
  })

  it("leaves the mark alone when the request is about something else", async () => {
    const player = await newPlayer()
    as("ADMIN")
    await patch(player.id, { inactive: true })
    expect((await patch(player.id, { country: "at" })).status).toBe(200)
    expect(await stored(player.id)).toBe(true)
  })

  it("is for admins and managers only", async () => {
    const player = await newPlayer()
    as("PLAYER")
    expect((await patch(player.id, { inactive: true })).status).toBe(403)
    as(null)
    expect((await patch(player.id, { inactive: true })).status).toBe(401)
    expect(await stored(player.id)).toBe(false)
  })

  it("refuses anything but yes or no, and an unknown player", async () => {
    const player = await newPlayer()
    as("MANAGER")
    expect((await patch(player.id, { inactive: "yes" })).status).toBe(400)
    expect(await stored(player.id)).toBe(false)
    expect((await patch("no-such-player", { inactive: true })).status).toBe(404)
  })

  it("stores the nickname without surrounding spaces and removes it when emptied", async () => {
    const player = await newPlayer()
    as("MANAGER")
    const named = await patch(player.id, { nickname: "  Dennis " })
    expect(named.status).toBe(200)
    expect(await named.json()).toMatchObject({ nickname: "Dennis" })
    expect((await patch(player.id, { nickname: "" })).status).toBe(200)
    expect((await client.player.findUniqueOrThrow({ where: { id: player.id } })).nickname).toBeNull()
  })
})
