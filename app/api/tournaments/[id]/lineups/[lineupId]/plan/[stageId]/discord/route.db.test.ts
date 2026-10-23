import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"

// The route runs against a temporary PostgreSQL schema; who is signed in and what the bot answers is given by the test
const state = vi.hoisted(() => ({ client: undefined as unknown, session: null as unknown, snapshot: null as unknown, announcements: [] as unknown[], posted: [] as unknown[] }))
vi.mock("@/lib/db", () => ({ get db() { return state.client } }))
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }))
vi.mock("@/lib/discord-bot", async (original) => ({
  ...(await original<typeof import("@/lib/discord-bot")>()),
  fetchReactions: async () => state.snapshot,
  fetchAnnouncements: async () => state.announcements,
  fetchServerEmojis: async () => [{ key: "custom:501", name: "b2fix", text: "<:b2fix:501>", imageUrl: "https://cdn.discordapp.com/emojis/501.png" }],
  postAnnouncement: async (channelId: string, text: string, emojis: string[]) => {
    state.posted.push({ channelId, text, emojis })
    return { messageUrl: `https://discord.com/channels/1/${channelId}/77`, messageId: "77", channelId, postedAt: "2026-10-20T18:00:00.000Z", author: "B2 Bot", text }
  },
}))
import { POST } from "./route"
import { PATCH } from "../route"

describe.skipIf(process.env.DB_TESTS !== "1")("Discord for the matchday planning with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `route_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  let ids: { comp: string; lineup: string; stage: string; stage2: string; manager: string; other: string; anna: string; ben: string; zoe: string }
  beforeAll(async () => {
    process.env.MATCHDAY_PLANNING = "on"
    process.env.AUTH_SECRET ??= "test-secret"
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
    state.client = client

    const user = (name: string) => client.user.create({ data: { name, username: name, password: "x", role: "PLAYER" } })
    const player = (name: string, discordUserId: string) => client.player.create({ data: { name, initialName: name, tmId: crypto.randomUUID(), discordUserId } })
    const [manager, other] = [await user("manager"), await user("other")]
    const [anna, ben, zoe] = [await player("Anna", "101"), await player("Ben", "102"), await player("Zoe", "109")]
    const comp = await client.tournament.create({ data: { name: "Comp", formats: ["ROUND_1V1"], style: "MIXED", startDate: new Date("2026-10-21T00:00:00Z"), stages: { create: [{ type: "GROUP", number: 1 }, { type: "GROUP", number: 2 }] } }, include: { stages: true } })
    const stage = comp.stages.find((s) => s.number === 1)!, stage2 = comp.stages.find((s) => s.number === 2)!
    // Zoe plays in another lineup
    const lineup = await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "A", slots: { create: [{ playerId: anna.id }, { playerId: ben.id }] }, managers: { create: { userId: manager.id } } } })
    await client.tournamentLineup.create({ data: { tournamentId: comp.id, name: "B", slots: { create: [{ playerId: zoe.id }] } } })
    ids = { comp: comp.id, lineup: lineup.id, stage: stage.id, stage2: stage2.id, manager: manager.id, other: other.id, anna: anna.id, ben: ben.id, zoe: zoe.id }
  }, 30000)
  afterAll(async () => { delete process.env.MATCHDAY_PLANNING; await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  const ping = (id: string, postedAt: string) => ({ messageUrl: `https://discord.com/channels/1/22/${id}`, messageId: id, channelId: "22", postedAt, author: "Boss", text: "<@900> who is there?" })
  const params = (stageId = ids.stage) => ({ params: Promise.resolve({ id: ids.comp, lineupId: ids.lineup, stageId }) })
  const post = (body: unknown, stageId?: string) => POST(new Request("http://test/discord", { method: "POST", body: JSON.stringify(body) }), params(stageId))
  const patch = (body: unknown) => PATCH(new Request("http://test/plan", { method: "PATCH", body: JSON.stringify(body) }), params())
  const answers = async () => Object.fromEntries((await client.matchdayPlanAnswer.findMany({ where: { plan: { lineupId: ids.lineup, stageId: ids.stage } } })).map((a) => [a.playerId, { answer: a.answer, answeredAt: a.answeredAt?.toISOString() ?? null }]))

  it("is for the lineup's managers and for admins and managers only, and not there while switched off", async () => {
    state.session = null
    expect((await post({ action: "announcements" })).status).toBe(401)
    state.session = { user: { id: ids.other, role: "PLAYER" } }
    expect((await post({ action: "channel", link: "https://discord.com/channels/1/22" })).status).toBe(403)
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    process.env.MATCHDAY_PLANNING = "off"
    expect((await post({ action: "announcements" })).status).toBe(404)
    process.env.MATCHDAY_PLANNING = "on"
  })

  it("keeps the lineup channel once and suggests the latest ping before the match day no other match day uses", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    expect((await post({ action: "channel", link: "https://example.com/x" })).status).toBe(400)
    expect((await post({ action: "channel", link: "https://discord.com/channels/1/22/555" })).status).toBe(200)
    expect((await client.tournamentLineup.findUniqueOrThrow({ where: { id: ids.lineup } })).discordChannelId).toBe("22")
    state.announcements = [ping("30", "2026-10-26T18:00:00.000Z"), ping("20", "2026-10-19T18:00:00.000Z"), ping("10", "2026-10-12T18:00:00.000Z")]
    // Match day 2 already uses the ping of 19 October
    expect((await post({ action: "choose", messageUrl: ping("20", "").messageUrl }, ids.stage2)).status).toBe(200)
    const listed = await (await post({ action: "announcements" })).json()
    expect(listed.suggested).toBe(ping("10", "").messageUrl)
    expect(listed.taken).toEqual([ping("20", "").messageUrl])
    expect(listed.announcements).toHaveLength(3)
  })

  it("takes only pings of the lineup channel as the announcement", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    expect((await post({ action: "choose", messageUrl: "https://discord.com/channels/1/99/10" })).status).toBe(400)
    expect((await post({ action: "choose", messageUrl: ping("10", "").messageUrl })).status).toBe(200)
  })

  it("applies the reactions of the kader with their times, leaves unlinked and outside accounts out, and refuses a stale preview", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    state.snapshot = {
      messageUrl: ping("10", "").messageUrl, fetchedAt: new Date().toISOString(),
      users: [{ id: "101", name: "Anna" }, { id: "102", name: "Ben" }, { id: "109", name: "Zoe" }, { id: "150", name: "Guest" }],
      reactions: [
        { key: "unicode:✅", label: "✅", userIds: ["101", "109", "150"], reactedAt: { "101": "2026-10-12T18:05:00.000Z" } },
        { key: "unicode:🕗", label: "🕗", userIds: ["102"] },
      ],
    }
    const fetched = await (await post({ action: "fetch" })).json()
    expect(fetched.unlinked).toEqual([{ id: "150", name: "Guest" }])
    const mapping = { "unicode:✅": "FIX", "unicode:🕗": "PARTIAL" }
    // An answer set by hand after the fetch makes the preview stale
    await patch({ action: "answer", playerId: ids.ben, answer: "OUT" })
    expect((await post({ action: "apply", token: fetched.token, emojiMapping: mapping, resolutions: {} })).status).toBe(409)
    const again = await (await post({ action: "fetch" })).json()
    const applied = await post({ action: "apply", token: again.token, emojiMapping: mapping, resolutions: {} })
    expect(applied.status).toBe(200)
    expect(await answers()).toEqual({
      [ids.anna]: { answer: "FIX", answeredAt: "2026-10-12T18:05:00.000Z" },
      [ids.ben]: { answer: "PARTIAL", answeredAt: null },
    })
    const plan = await client.matchdayPlan.findFirstOrThrow({ where: { lineupId: ids.lineup, stageId: ids.stage } })
    expect(plan.discordSettings).toMatchObject({ messageUrl: ping("10", "").messageUrl, emojiMapping: mapping })
    // Applying the same preview twice is refused, as the answers changed
    expect((await post({ action: "apply", token: again.token, emojiMapping: mapping, resolutions: {} })).status).toBe(409)
  })

  it("does not apply a preview fetched for another match day", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    const fetched = await (await post({ action: "fetch" })).json()
    expect((await post({ action: "apply", token: fetched.token, emojiMapping: { "unicode:✅": "FIX", "unicode:🕗": "PARTIAL" }, resolutions: {} }, ids.stage2)).status).toBe(400)
  })

  it("lets the bot post the announcement with the chosen emojis, which mean their answers from the start, and offers them next time", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    const emojis = [{ key: "custom:501", text: "<:b2fix:501>", answer: "FIX" }, { key: "unicode:🚫", text: "🚫", answer: "OUT" }]
    const first = await (await post({ action: "emojis" }, ids.stage2)).json()
    expect(first.server).toHaveLength(1)
    expect(first.lastUsed.map((e: { text: string }) => e.text)).toEqual(["✅", "🕗", "❔", "❌"])
    expect((await post({ action: "post", text: "", emojis }, ids.stage2)).status).toBe(400)
    expect((await post({ action: "post", text: "Who?", emojis: [{ key: "custom:501", text: "<:b2fix:999>", answer: "FIX" }] }, ids.stage2)).status).toBe(400)
    expect((await post({ action: "post", text: "Who is there?", emojis }, ids.stage2)).status).toBe(200)
    expect(state.posted).toEqual([{ channelId: "22", text: "Who is there?", emojis: ["<:b2fix:501>", "🚫"] }])
    const plan = await client.matchdayPlan.findFirstOrThrow({ where: { lineupId: ids.lineup, stageId: ids.stage2 } })
    expect(plan.discordSettings).toEqual({ messageUrl: "https://discord.com/channels/1/22/77", emojiMapping: { "custom:501": "FIX", "unicode:🚫": "OUT" }, emojis, postedAt: "2026-10-20T18:00:00.000Z" })
    // Another match day of the lineup starts with these emojis
    expect((await (await post({ action: "emojis" })).json()).lastUsed).toEqual(emojis)
    state.session = { user: { id: ids.other, role: "PLAYER" } }
    expect((await post({ action: "post", text: "Who is there?", emojis }, ids.stage2)).status).toBe(403)
  })

  it("takes the reactions over at once on fetching, keeps who reacted twice to be resolved and waits for emojis without a meaning", async () => {
    state.session = { user: { id: ids.manager, role: "PLAYER" } }
    await client.matchdayPlan.update({ where: { lineupId_stageId: { lineupId: ids.lineup, stageId: ids.stage } }, data: { discordSettings: { messageUrl: ping("10", "").messageUrl, emojiMapping: { "unicode:✅": "FIX", "unicode:🕗": "PARTIAL", "unicode:❌": "OUT" } } } })
    await client.matchdayPlanAnswer.deleteMany({ where: { plan: { lineupId: ids.lineup, stageId: ids.stage } } })
    state.snapshot = {
      messageUrl: ping("10", "").messageUrl, fetchedAt: new Date().toISOString(),
      users: [{ id: "101", name: "Anna" }, { id: "102", name: "Ben" }, { id: "150", name: "Guest" }],
      reactions: [
        { key: "unicode:✅", label: "✅", userIds: ["101", "102", "150"], reactedAt: { "101": "2026-10-12T18:05:00.000Z" } },
        { key: "unicode:❌", label: "❌", userIds: ["102"] },
      ],
    }
    const synced = await (await post({ action: "sync" })).json()
    // Anna is taken over at once; Ben reacted with Fix and Out and waits
    expect(synced.applied).toEqual([{ playerId: ids.anna, before: null, after: "FIX", time: "2026-10-12T18:05:00.000Z" }])
    expect(synced.conflicts.map((r: { playerId: string }) => r.playerId)).toEqual([ids.ben])
    expect(synced.unlinked).toEqual([{ id: "150", name: "Guest" }])
    expect(await answers()).toEqual({ [ids.anna]: { answer: "FIX", answeredAt: "2026-10-12T18:05:00.000Z" } })
    // Resolving Ben goes through the preview the sync handed over
    const resolved = await post({ action: "apply", token: synced.token, emojiMapping: { "unicode:✅": "FIX", "unicode:🕗": "PARTIAL", "unicode:❌": "OUT" }, resolutions: { [ids.ben]: "OUT" } })
    expect(resolved.status).toBe(200)
    expect((await answers())[ids.ben]).toEqual({ answer: "OUT", answeredAt: null })

    // A reaction with an emoji nobody gave a meaning yet: nothing is taken over before it has one
    state.snapshot = { ...(state.snapshot as object), reactions: [{ key: "unicode:🎉", label: "🎉", userIds: ["101"] }] }
    const waiting = await (await post({ action: "sync" })).json()
    expect(waiting.applied).toBeNull()
    expect(waiting.snapshot.reactions.map((r: { key: string }) => r.key)).toEqual(["unicode:🎉"])
    expect((await answers())[ids.anna].answer).toBe("FIX")
  })
})
