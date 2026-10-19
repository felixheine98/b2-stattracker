import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema; only who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown, snapshot: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/discord-bot", async original => ({ ...await original<typeof import("@/lib/discord-bot")>(), fetchReactions: async () => state.snapshot }))
import { POST } from "./route"

describe.skipIf(process.env.DB_TESTS !== "1")("Discord import into a planning with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client
    process.env.AUTH_SECRET ??= "test-secret"
    state.session = { user: { id: "user", role: "MANAGER" } }
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const url = "https://discord.com/channels/1/2/3"
  const post = (id: string, body: unknown) => POST(new Request("http://test/api/discord", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
  const setup = async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const [anna, ben] = await Promise.all(["Anna", "Ben"].map((name, i) => client.player.create({ data: { tmId: crypto.randomUUID(), name: name + tag, initialName: name + tag, discordUserId: i === 0 ? `9${tag.replace(/\D/g, "1")}1` : null } })))
    const comp = await client.tournament.create({ data: { name: `Comp ${tag}`, formats: ["ROUND_1V1"], style: "MIXED", planning: { create: {} } } })
    const linked = anna.discordUserId!, unknown = `${linked}2`, open = `${linked}3`, staff = `${linked}4`
    state.snapshot = { messageUrl: url, fetchedAt: new Date().toISOString(),
      users: [linked, unknown, open, staff].map(id => ({ id, name: `user ${id}` })),
      reactions: [{ key: "unicode:✅", label: "✅", userIds: [linked, unknown, open, staff] }] }
    return { comp, anna, ben, linked, unknown, open, staff }
  }
  const settings = async (compId: string) => (await client.planning.findUniqueOrThrow({ where: { tournamentId: compId } }))
  const answer = async (compId: string, playerId: string) => (await client.planningEntry.findFirst({ where: { planning: { tournamentId: compId }, playerId } }))?.status ?? null

  it("saves the message link on fetch and offers only accounts that are neither linked nor marked", async () => {
    const { comp, linked, unknown, open, staff } = await setup()
    await client.discordNonPlayer.create({ data: { discordUserId: staff } })
    const response = await post(comp.id, { action: "fetch", messageUrl: url })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.identities).toEqual({ [linked]: expect.any(String) })
    expect(data.unknown.map((u: { id: string }) => u.id)).toEqual([unknown, open])
    expect(await settings(comp.id)).toMatchObject({ revision: 0, discordSettings: { messageUrl: url } })
  })

  it("remembers when the reactions were last fetched, also after applying them", async () => {
    const { comp, unknown, staff } = await setup()
    const { fetchedAt } = state.snapshot as { fetchedAt: string }
    const { token } = await (await post(comp.id, { action: "fetch", messageUrl: url })).json()
    expect(await settings(comp.id)).toMatchObject({ discordSettings: { fetchedAt } })
    await post(comp.id, { action: "settings", emojiMapping: { "unicode:✅": "FIX" } })
    expect(await settings(comp.id)).toMatchObject({ discordSettings: { fetchedAt } })
    const applied = await post(comp.id, { action: "apply", token, emojiMapping: { "unicode:✅": "FIX" }, links: {}, notAPlayer: [unknown, staff], resolutions: {} })
    expect(applied.status).toBe(200)
    expect(await settings(comp.id)).toMatchObject({ discordSettings: { fetchedAt } })
  })

  it("saves an emoji choice at once without invalidating the preview, then applies links, marks and answers", async () => {
    const { comp, anna, ben, linked, unknown, open, staff } = await setup()
    const { token } = await (await post(comp.id, { action: "fetch", messageUrl: url })).json()
    expect((await post(comp.id, { action: "settings", emojiMapping: { "unicode:✅": "FIX" } })).status).toBe(200)
    expect(await settings(comp.id)).toMatchObject({ revision: 0, discordSettings: { messageUrl: url, emojiMapping: { "unicode:✅": "FIX" } } })
    const applied = await post(comp.id, { action: "apply", token, emojiMapping: { "unicode:✅": "FIX" }, links: { [unknown]: ben.id }, notAPlayer: [staff], resolutions: {} })
    expect(applied.status).toBe(200)
    expect([await answer(comp.id, anna.id), await answer(comp.id, ben.id)]).toEqual(["FIX", "FIX"])
    expect((await client.player.findUniqueOrThrow({ where: { id: ben.id } })).discordUserId).toBe(unknown)
    expect(await client.discordNonPlayer.findUnique({ where: { discordUserId: staff } })).not.toBeNull()
    expect(await client.player.findFirst({ where: { discordUserId: open } })).toBeNull()
    expect(linked).toBe(anna.discordUserId)
  })
})
