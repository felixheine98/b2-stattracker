import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { PATCH } from "./route"

describe.skipIf(process.env.DB_TESTS !== "1")("VOD links of a match with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  let ids: { comp: string; match: string; manager: string; other: string }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client

    const user = (name: string) => client.user.create({ data: { name, username: name, password: "x", role: "PLAYER" } })
    const [manager, other] = [await user("manager"), await user("other")]
    const comp = await client.tournament.create({ data: { name: "EMC", formats: ["ROUND_1V1"], style: "MIXED", stages: { create: { type: "GROUP", number: 1 } } }, include: { stages: true } })
    const lineup = await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "B2 Academy", managers: { create: { userId: manager.id } } } })
    const match = await client.match.create({ data: { tournamentId: comp.id, tournamentLineupId: lineup.id, stageId: comp.stages[0].id, notes: "Bo3" } })
    ids = { comp: comp.id, match: match.id, manager: manager.id, other: other.id }
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const patch = (body: unknown) => PATCH(new Request("http://test/opponent", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: ids.comp, matchId: ids.match }) })
  const stored = async () => client.match.findUniqueOrThrow({ where: { id: ids.match } })

  it("is for whoever may edit the lineup", async () => {
    state.session = { user: { id: ids.other, role: "PLAYER" } }
    expect((await patch({ action: "edit", vods: [{ url: "https://www.twitch.tv/videos/1" }] })).status).toBe(403)
    expect((await stored()).vods).toEqual([])
  })

  it("keeps the VOD links of a match, cleaned up, with an optional name each", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    const res = await patch({ action: "edit", vods: [{ url: "twitch.tv/videos/2281234567?t=1h02m", label: " Cast " }, { url: "https://youtu.be/abc", label: "" }, { url: "  ", label: "empty rows are dropped" }] })
    expect(res.status).toBe(200)
    expect((await stored()).vods).toEqual([{ url: "https://twitch.tv/videos/2281234567?t=1h02m", label: "Cast" }, { url: "https://youtu.be/abc", label: null }])
  })

  it("leaves the links alone when the edit does not touch them", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    expect((await patch({ action: "edit", notes: "Bo5" })).status).toBe(200)
    expect((await stored()).vods).toHaveLength(2)
  })

  it("refuses anything that is not a web link and keeps what was there", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    const res = await patch({ action: "edit", vods: [{ url: "javascript:alert(1)" }] })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/link/i)
    expect((await stored()).vods).toHaveLength(2)
  })

  it("removes all links", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    expect((await patch({ action: "edit", vods: [] })).status).toBe(200)
    expect((await stored()).vods).toEqual([])
  })
})
