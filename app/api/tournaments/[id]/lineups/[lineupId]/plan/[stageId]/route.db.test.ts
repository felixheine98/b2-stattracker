import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema; who is signed in is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { GET, PATCH } from "./route"

describe.skipIf(process.env.DB_TESTS !== "1")("matchday planning with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  let ids: { comp: string; lineup: string; stage: string; manager: string; other: string; anna: string; ben: string; match: string }
  beforeAll(async () => {
    process.env.MATCHDAY_PLANNING = "on"
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client

    const user = (name: string) => client.user.create({ data: { name, username: name, password: "x", role: "PLAYER" } })
    const player = (name: string) => client.player.create({ data: { name, initialName: name, tmId: crypto.randomUUID() } })
    const [manager, other, anna, ben] = [await user("manager"), await user("other"), await player("Anna"), await player("Ben")]
    const comp = await client.tournament.create({ data: { name: "Comp", formats: ["ROUND_1V1", "ROUND_2V2"], style: "MIXED", stages: { create: { type: "GROUP", number: 1 } } }, include: { stages: true } })
    const lineup = await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "A", slots: { create: [{ playerId: anna.id }, { playerId: ben.id }] }, managers: { create: { userId: manager.id } } } })
    const match = await client.match.create({ data: { tournamentId: comp.id, tournamentLineupId: lineup.id, stageId: comp.stages[0].id, subMatches: { create: [{ format: "ROUND_1V1", order: 1 }, { format: "ROUND_2V2", order: 2 }] } } })
    ids = { comp: comp.id, lineup: lineup.id, stage: comp.stages[0].id, manager: manager.id, other: other.id, anna: anna.id, ben: ben.id, match: match.id }
  }, 30000)
  afterAll(async () => { delete process.env.MATCHDAY_PLANNING; await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const params = () => ({ params: Promise.resolve({ id: ids.comp, lineupId: ids.lineup, stageId: ids.stage }) })
  const get = () => GET(new Request("http://test/plan"), params())
  const patch = (body: unknown) => PATCH(new Request("http://test/plan", { method: "PATCH", body: JSON.stringify(body) }), params())

  it("is for the lineup's managers and for admins and managers only", async () => {
    state.session = null
    expect((await get()).status).toBe(401)
    state.session = { user: { id: ids.other, role: "PLAYER" } }
    expect((await get()).status).toBe(403)
    expect((await patch({ action: "answer", playerId: ids.anna, answer: "FIX" })).status).toBe(403)
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    expect((await get()).status).toBe(200)
    state.session = { user: { id: ids.other, role: "MANAGER" } }
    expect((await get()).status).toBe(200)
  })

  it("is not there while the planning is switched off", async () => {
    state.session = { user: { id: ids.manager, role: "ADMIN" } }
    process.env.MATCHDAY_PLANNING = "off"
    expect((await get()).status).toBe(404)
    process.env.MATCHDAY_PLANNING = "on"
  })

  it("starts with one empty variant and no answers, and saves answers set by hand", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    const plan = await (await get()).json()
    expect(plan.variants).toHaveLength(1)
    expect(plan.answers).toEqual({})
    expect(plan.matches).toMatchObject([{ id: ids.match, formats: ["ROUND_1V1", "ROUND_2V2"] }])
    const saved = await (await patch({ action: "answer", playerId: ids.anna, answer: "PARTIAL", note: "until 22:00" })).json()
    expect(saved.answers[ids.anna]).toMatchObject({ answer: "PARTIAL", note: "until 22:00" })
    const absent = await (await patch({ action: "absence", playerId: ids.anna, matchId: ids.match, absent: true })).json()
    expect(absent.absences).toEqual([{ playerId: ids.anna, matchId: ids.match }])
  })

  it("plans only players of the lineup and publishes the lineup of every match on finalising", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    const { variants: [variant] } = await (await get()).json()
    const outsider = (await client.player.create({ data: { name: "Out", initialName: "Out", tmId: crypto.randomUUID() } })).id
    expect((await patch({ action: "seats", variantId: variant.id, seats: { day: { ROUND_1V1: [outsider] }, matches: {} } })).status).toBe(400)

    await patch({ action: "seats", variantId: variant.id, seats: { day: { ROUND_1V1: [ids.anna], ROUND_2V2: [ids.anna, ids.ben] }, matches: { [ids.match]: { ROUND_1V1: [ids.ben] } } } })
    const published = await (await patch({ action: "publish", variantId: variant.id })).json()
    expect(published.publishedVariantId).toBe(variant.id)
    expect(published.published.matches[ids.match]).toEqual({ ROUND_1V1: [ids.ben], ROUND_2V2: [ids.anna, ids.ben] })
  })
})
