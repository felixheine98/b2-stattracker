import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
import { POST, PUT } from "./route"

const VOD = "https://www.twitch.tv/videos/2281234567?t=1h02m30s"

describe.skipIf(process.env.DB_TESTS !== "1")("VOD ranges with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  let ids: { comp: string; match: string; admin: string; manager: string; lineupManager: string }
  beforeAll(async () => {
    vi.stubEnv("VOD_ARCHIVE", "manual")
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client

    const user = (name: string, role: "ADMIN" | "MANAGER" | "PLAYER") => client.user.create({ data: { name, username: name, password: "x", role } })
    const [admin, manager, lineupManager] = [await user("admin", "ADMIN"), await user("manager", "MANAGER"), await user("lineup", "PLAYER")]
    const comp = await client.tournament.create({ data: { name: "EMC", formats: ["ROUND_1V1"], style: "MIXED", stages: { create: { type: "GROUP", number: 1 } } }, include: { stages: true } })
    const lineup = await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "B2 Academy", managers: { create: { userId: lineupManager.id } } } })
    const match = await client.match.create({ data: { tournamentId: comp.id, tournamentLineupId: lineup.id, stageId: comp.stages[0].id, vods: [{ url: VOD, label: "Cast" }, { url: "https://clips.twitch.tv/SomeClip", label: null }] } })
    ids = { comp: comp.id, match: match.id, admin: admin.id, manager: manager.id, lineupManager: lineupManager.id }
  }, 30000)
  afterAll(async () => { vi.unstubAllEnvs(); await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const put = (body: unknown) => PUT(new Request("http://test/vod-clip", { method: "PUT", body: JSON.stringify(body) }), { params: Promise.resolve({ id: ids.comp, matchId: ids.match }) })
  const post = (body: unknown) => POST(new Request("http://test/vod-clip", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: ids.comp, matchId: ids.match }) })
  const clip = () => client.vodClip.findFirstOrThrow({ where: { matchId: ids.match, url: VOD } })
  const clips = async () => (await client.vodClip.findMany({ where: { matchId: ids.match } })).map((c) => [c.url, c.start, c.end])
  const as = (id: string, role: string) => { state.session = { user: { id, role } } }

  it("is for admins and managers, not for a lineup's own managers", async () => {
    state.session = null
    expect((await put({ url: VOD, start: 3750, end: 6490 })).status).toBe(401)
    as(ids.lineupManager, "PLAYER")
    expect((await put({ url: VOD, start: 3750, end: 6490 })).status).toBe(403)
    expect(await clips()).toEqual([])
  })

  it("is not there while the VOD archive is switched off", async () => {
    as(ids.admin, "ADMIN")
    vi.stubEnv("VOD_ARCHIVE", "off")
    expect((await put({ url: VOD, start: 3750, end: 6490 })).status).toBe(404)
    expect((await post({ url: VOD })).status).toBe(404)
    vi.stubEnv("VOD_ARCHIVE", "manual")
    expect(await clips()).toEqual([])
  })

  it("keeps the range of a Twitch VOD of the match", async () => {
    as(ids.manager, "MANAGER")
    expect((await put({ url: VOD, start: 3750, end: 6490 })).status).toBe(200)
    expect(await clips()).toEqual([[VOD, 3750, 6490]])
  })

  it("replaces the range when it is set again", async () => {
    as(ids.admin, "ADMIN")
    expect((await put({ url: VOD, start: 3700, end: 6500 })).status).toBe(200)
    expect(await clips()).toEqual([[VOD, 3700, 6500]])
  })

  it("refuses ranges on links that are not a Twitch VOD of this match, and ranges that do not fit", async () => {
    as(ids.admin, "ADMIN")
    expect((await put({ url: "https://www.twitch.tv/videos/999", start: 0, end: 60 })).status).toBe(400)
    expect((await put({ url: "https://clips.twitch.tv/SomeClip", start: 0, end: 60 })).status).toBe(400)
    const res = await put({ url: VOD, start: 6500, end: 3700 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/before the end/)
    expect(await clips()).toEqual([[VOD, 3700, 6500]])
  })

  it("queues the backup of a saved range", async () => {
    expect(await clip()).toMatchObject({ status: "WAITING", attempts: 0, youtubeId: null })
  })

  it("leaves a backup alone when the same range is saved again", async () => {
    as(ids.admin, "ADMIN")
    await client.vodClip.update({ where: { id: (await clip()).id }, data: { status: "DONE", youtubeId: "old-video" } })
    expect((await put({ url: VOD, start: 3700, end: 6500 })).status).toBe(200)
    expect(await clip()).toMatchObject({ status: "DONE", youtubeId: "old-video", replacesYoutubeId: null })
  })

  it("backs a changed range up anew, keeping the old video until the new one replaces it", async () => {
    as(ids.admin, "ADMIN")
    expect((await put({ url: VOD, start: 3600, end: 6500 })).status).toBe(200)
    expect(await clip()).toMatchObject({ status: "WAITING", attempts: 0, error: null, youtubeId: "old-video", replacesYoutubeId: "old-video" })
  })

  it("starts a backup by hand, also again after it failed; only for admins and managers", async () => {
    await client.vodClip.update({ where: { id: (await clip()).id }, data: { status: "FAILED", attempts: 4, error: "HTTP Error 503", nextAttemptAt: null } })
    as(ids.lineupManager, "PLAYER")
    expect((await post({ url: VOD })).status).toBe(403)
    as(ids.manager, "MANAGER")
    expect((await post({ url: "https://www.twitch.tv/videos/999" })).status).toBe(404)
    expect((await post({ url: VOD })).status).toBe(200)
    const queued = await clip()
    expect(queued).toMatchObject({ status: "WAITING", attempts: 0, error: null, nextAttemptAt: null })
    expect(queued.requestedAt).toBeInstanceOf(Date)
  })
})
