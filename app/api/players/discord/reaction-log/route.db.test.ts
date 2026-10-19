import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema; the bot's list and who is signed in are given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown, tracked: [] as unknown[] }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/discord-bot", () => ({ removeTrackedMessage: async () => {}, fetchTrackedMessages: async () => ({ guildId: "1", messages: state.tracked }) }))
import { PUT } from "./route"

describe.skipIf(process.env.DB_TESTS !== "1")("assigning a tracked message to a comp with PostgreSQL", () => {
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

  const message = (messageId: string, channelId: string | null = "2") => ({ messageId, channelId, since: "2026-10-19T20:00:00.000Z", trackedAt: "2026-10-19T20:00:00.000Z", reactions: 1, lastAt: null })
  const comp = (planning = true) => client.tournament.create({ data: { name: `Comp ${crypto.randomUUID().slice(0, 8)}`, formats: ["ROUND_1V1"], style: "MIXED", ...(planning && { planning: { create: {} } }) } })
  const put = (body: unknown) => PUT(new Request("http://test/api/reaction-log", { method: "PUT", body: JSON.stringify(body) }))
  const saved = async (tournamentId: string) => (await client.planning.findUniqueOrThrow({ where: { tournamentId } }))

  it("saves the link of the message with the comp and keeps its emoji choices and revision", async () => {
    state.tracked = [message("10")]
    const { id } = await comp()
    await client.planning.update({ where: { tournamentId: id }, data: { discordSettings: { messageUrl: "", emojiMapping: { "unicode:✅": "FIX" } } } })
    const response = await put({ messageId: "10", tournamentId: id })
    expect(response.status).toBe(200)
    expect(await saved(id)).toMatchObject({ revision: 0, discordSettings: { messageUrl: "https://discord.com/channels/1/2/10", emojiMapping: { "unicode:✅": "FIX" } } })
  })

  it("asks before replacing the message a comp already uses, and does so when told to", async () => {
    state.tracked = [message("11")]
    const { id } = await comp()
    await client.planning.update({ where: { tournamentId: id }, data: { discordSettings: { messageUrl: "https://discord.com/channels/1/2/99", emojiMapping: {} } } })
    const refused = await put({ messageId: "11", tournamentId: id })
    expect(refused.status).toBe(409)
    expect((await refused.json()).replaces).toBe(true)
    expect((await saved(id)).discordSettings).toMatchObject({ messageUrl: "https://discord.com/channels/1/2/99" })
    expect((await put({ messageId: "11", tournamentId: id, replace: true })).status).toBe(200)
    expect((await saved(id)).discordSettings).toMatchObject({ messageUrl: "https://discord.com/channels/1/2/11" })
  })

  it("does not ask when the comp already has this very message", async () => {
    state.tracked = [message("12")]
    const { id } = await comp()
    expect((await put({ messageId: "12", tournamentId: id })).status).toBe(200)
    expect((await put({ messageId: "12", tournamentId: id })).status).toBe(200)
  })

  it("refuses a message the bot does not keep, one without a known channel, and comps that cannot take a link", async () => {
    const { id } = await comp()
    state.tracked = [message("13", null)]
    expect((await put({ messageId: "404", tournamentId: id })).status).toBe(404)
    expect((await put({ messageId: "13", tournamentId: id })).status).toBe(400)
    state.tracked = [message("14")]
    expect((await put({ messageId: "14", tournamentId: (await comp(false)).id })).status).toBe(404)
    const closed = await comp()
    await client.tournamentLineup.create({ data: { tournamentId: closed.id, name: "A" } })
    expect((await put({ messageId: "14", tournamentId: closed.id })).status).toBe(409)
    expect((await put({ messageId: "14", tournamentId: "nope" })).status).toBe(404)
    expect((await put({ messageId: "x" })).status).toBe(400)
  })
})
