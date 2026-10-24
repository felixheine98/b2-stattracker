import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

// The route runs against a temporary PostgreSQL schema; Google is stood in for by the S7 master sheet
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/seeding-sheet-fetch", () => ({
  fetchSeedingSheet: async () => ({
    seeding: readFileSync(new URL("../../../../../../../lib/fixtures/emc-s7-seeding.csv", import.meta.url), "utf8"),
    leagues: readFileSync(new URL("../../../../../../../lib/fixtures/emc-s7-leagues.csv", import.meta.url), "utf8"),
  }),
}))
import { PATCH } from "./route"

const URL_S7 = "https://docs.google.com/spreadsheets/d/11YhnQdGPvW3DviWTz8yLWychV-pss0JFZNotfHRWqKU/edit?gid=202073940"

describe.skipIf(process.env.DB_TESTS !== "1")("seeding results with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  let ids: { comp: string; match: string; stage: string; manager: string; other: string; crypii: string; p3k: string; runs: string[] }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client

    const user = (name: string) => client.user.create({ data: { name, username: name, password: "x", role: "PLAYER" } })
    const player = (name: string, tmId: string) => client.player.create({ data: { name, initialName: name, tmId } })
    const [manager, other] = [await user("manager"), await user("other")]
    const crypii = await player("crypii", "81909621-cd53-43aa-82bb-238fb9bdeb88")
    // Any case in the account ID
    const p3k = await player("P3kingente", "2B3AD3CD-E02E-459C-8D14-B36D46C2E2FD")
    const comp = await client.tournament.create({ data: { name: "EMC", formats: ["ROUND_1V1"], style: "MIXED", seedingType: "EMC", stages: { create: { type: "SEEDING", number: 1 } } }, include: { stages: true } })
    const lineup = await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "B2 Academy", slots: { create: [{ playerId: crypii.id }, { playerId: p3k.id }] }, managers: { create: { userId: manager.id } } } })
    const layout = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 2, 0], [1, 2, 1], [1, 3, 0], [1, 3, 1]]
    const match = await client.match.create({
      data: { tournamentId: comp.id, tournamentLineupId: lineup.id, stageId: comp.stages[0].id, subMatches: { create: layout.map(([map, slot, server], order) => ({ format: "SEEDING_RUN", order, seedingRun: { create: { map, slot, server } } })) } },
      include: { subMatches: { orderBy: { order: "asc" } } },
    })
    ids = { comp: comp.id, match: match.id, stage: comp.stages[0].id, manager: manager.id, other: other.id, crypii: crypii.id, p3k: p3k.id, runs: match.subMatches.map((sm) => sm.id) }
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const patch = (body: unknown) => PATCH(new Request("http://test/seeding", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: ids.comp, matchId: ids.match }) })
  const runs = async () => (await client.seedingRun.findMany({ where: { subMatch: { matchId: ids.match } }, orderBy: { subMatch: { order: "asc" } } })).map((r) => [r.playerId, r.score])

  it("is for whoever may edit the lineup", async () => {
    state.session = null
    expect((await patch({ action: "preview", url: URL_S7 })).status).toBe(401)
    state.session = { user: { id: ids.other, role: "PLAYER" } }
    expect((await patch({ action: "preview", url: URL_S7 })).status).toBe(403)
  })

  it("previews the lineup's team from the master sheet without changing anything", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    const res = await patch({ action: "preview", url: URL_S7 })
    expect(res.status).toBe(200)
    const preview = await res.json()
    expect(preview.team).toBe("B2 Academy")
    expect(preview.teams).toContain("Molotov Gaming")
    expect(preview).toMatchObject({ maps: ["Bernage", "Incendiary"], rank: 19, league: "League 4 · Group H", total: 2202 })
    // Without a plan, the runs of a map are filled in the sheet's order: P3kingente before crypii
    expect(preview.runs.slice(0, 2)).toEqual([{ playerId: ids.p3k, score: 382 }, { playerId: ids.crypii, score: 463 }])
    // Drivers the app does not know are named, not imported
    expect(preview.unknown.map((u: { name: string }) => u.name)).toEqual(expect.arrayContaining(["Siri_TM", "hyperxrage", "BeNNy_TM"]))
    expect(await runs()).toEqual(Array(8).fill([null, null]))
  })

  it("takes the results over: scores and drivers on the runs, place, league and the maps' names", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    expect((await patch({ action: "import", url: URL_S7, team: "B2 Academy" })).status).toBe(200)
    expect((await runs()).slice(0, 2)).toEqual([[ids.p3k, 382], [ids.crypii, 463]])
    expect(await client.match.findUniqueOrThrow({ where: { id: ids.match } })).toMatchObject({ seedingPlace: 19, seedingLeague: "League 4 · Group H" })
    expect((await client.stage.findUniqueOrThrow({ where: { id: ids.stage } })).seedingMaps).toEqual(["Bernage", "Incendiary"])
    expect((await client.tournament.findUniqueOrThrow({ where: { id: ids.comp } })).seedingSheet).toBe(URL_S7)
    expect((await patch({ action: "import", url: URL_S7, team: "No Such Team" })).status).toBe(400)
  })

  it("records a run, the place and the league by hand", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    expect((await patch({ action: "run", subMatchId: ids.runs[4], playerId: ids.crypii, score: 250 })).status).toBe(200)
    expect((await runs())[4]).toEqual([ids.crypii, 250])
    expect((await patch({ action: "run", subMatchId: "elsewhere", playerId: null, score: null })).status).toBe(404)
    expect((await patch({ action: "result", place: 5, league: "Gold" })).status).toBe(200)
    expect(await client.match.findUniqueOrThrow({ where: { id: ids.match } })).toMatchObject({ seedingPlace: 5, seedingLeague: "Gold" })
  })
})
