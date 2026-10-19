import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema; only who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { POST } from "./route"

describe.skipIf(process.env.DB_TESTS !== "1")("POST /api/players/discord with PostgreSQL", () => {
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
  const post = (body: unknown) => POST(new Request("http://test/api/players/discord", { method: "POST", body: JSON.stringify(body) }))
  const newPlayer = (discordUserId: string | null = null) => client.player.create({ data: { tmId: crypto.randomUUID(), name: "TraTM", initialName: "TraTM", discordUserId } })
  const account = async (id: string) => (await client.player.findUniqueOrThrow({ where: { id } })).discordUserId
  const nonPlayer = async (discordUserId: string) => !!(await client.discordNonPlayer.findUnique({ where: { discordUserId } }))

  it("links accounts to players, several at once, replacing a player's previous account", async () => {
    const [a, b] = [await newPlayer("100"), await newPlayer()]
    as("MANAGER")
    expect((await post({ action: "link", links: [{ discordUserId: "101", playerId: a.id }, { discordUserId: "102", playerId: b.id }] })).status).toBe(200)
    expect([await account(a.id), await account(b.id)]).toEqual(["101", "102"])
  })

  it("moves an account that belonged to another player and lifts a not-a-player mark", async () => {
    const [a, b] = [await newPlayer("200"), await newPlayer()]
    await client.discordNonPlayer.create({ data: { discordUserId: "201" } })
    as("ADMIN")
    expect((await post({ action: "link", links: [{ discordUserId: "200", playerId: b.id }, { discordUserId: "201", playerId: a.id }] })).status).toBe(200)
    expect([await account(a.id), await account(b.id), await nonPlayer("201")]).toEqual(["201", "200", false])
  })

  it("unlinks an account and marks one as not a player, which also unlinks it, and takes the mark back", async () => {
    const a = await newPlayer("300"), b = await newPlayer("301")
    as("MANAGER")
    expect((await post({ action: "unlink", discordUserId: "300" })).status).toBe(200)
    expect(await account(a.id)).toBeNull()
    expect((await post({ action: "not-a-player", discordUserId: "301", value: true })).status).toBe(200)
    expect([await account(b.id), await nonPlayer("301")]).toEqual([null, true])
    expect((await post({ action: "not-a-player", discordUserId: "301", value: false })).status).toBe(200)
    expect(await nonPlayer("301")).toBe(false)
  })

  it("refuses two accounts for one player, unknown players and non-managers", async () => {
    const a = await newPlayer()
    as("MANAGER")
    expect((await post({ action: "link", links: [{ discordUserId: "400", playerId: a.id }, { discordUserId: "401", playerId: a.id }] })).status).toBe(400)
    expect((await post({ action: "link", links: [{ discordUserId: "402", playerId: "nobody" }] })).status).toBe(404)
    expect(await account(a.id)).toBeNull()
    as("PLAYER")
    expect((await post({ action: "unlink", discordUserId: "400" })).status).toBe(403)
    as(null)
    expect((await post({ action: "unlink", discordUserId: "400" })).status).toBe(401)
  })
})
