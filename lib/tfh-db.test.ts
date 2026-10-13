import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"
import { previewTfhImport, saveTfhImport, getTfhRace, getTfhPlayerResults, getTfhB2Results, isTfhTournament } from "./tfh-db"

describe.skipIf(process.env.TFH_DB_TESTS !== "1")("TFH archive with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `tfh_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await client.$transaction(async tx => { for (const statement of ddl.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  async function fixture(event = 6) {
    const accountId = crypto.randomUUID()
    const player = await client.player.create({ data: { tmId: accountId, name: "Current driver name", initialName: "Driver" } })
    const responses: Record<string, unknown> = {
      [`/event/24h/race/${event}/teams`]: `<p data-eventid="${event}" data-eventpath="/event/24h/race/${event}">TFH 24h #4</p>`,
      [`/api/event/${event}/teams`]: { Teams: [{ id: 1284, Name: "B2 historic", Trigram: "B2", NumberOfCP: 100, LastCPTime: 86399000, Players: [{ User: { AccountId: accountId, DisplayName: "Historic driver" } }] }] },
      [`/api/event/${event}/team/1284`]: { Rank: 1, StartDate: "2025-11-22T14:00:00Z", EndDate: "2025-11-23T14:00:00Z", Team: { id: 1284, Players: [{ User: { AccountId: accountId, DisplayName: "Historic driver" }, NumberOfCP: 100, CalculatedTotalPlayTime: 1200, CPsPerMinute: 5, BestLap: "12000,24000", AverageLap: "14000,26000", Finishes: [{ Timestamp: "2025-11-22T14:06:33Z", Time: 24000, Rank: 1, Type: 0 }] }] } },
    }
    const fetcher: typeof fetch = async input => { const value = responses[new URL(String(input)).pathname]; return new Response(typeof value === "string" ? value : JSON.stringify(value), { status: value ? 200 : 503 }) }
    return { player, responses, fetcher, url: `https://trackmaniaforhours.com/event/24h/race/${event}/teams` }
  }

  it("previews account matches and archives the ranking, historical lineup and source finishes together", async () => {
    const f = await fixture()
    const preview = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    expect(preview.assignments).toMatchObject([{ accountId: f.player.tmId, playerId: f.player.id }])
    const saved = await saveTfhImport({ draftId: preview.draftId, assignments: preview.assignments.map(a => ({ accountId: a.accountId, playerId: a.playerId! })) }, "admin", client)
    const race = await getTfhRace(saved.tournamentId, client)
    expect(race).toMatchObject({ sourceEventId: 6, teams: [{ name: "B2 historic", checkpoints: 100, lineup: { name: "B2 historic", slots: [{ playerId: f.player.id }] }, drivers: [{ sourceName: "Historic driver", playTimeSeconds: 1200, bestLapMs: 24000, finishes: [{ timeMs: 24000 }] }] }] })
    expect(await getTfhPlayerResults(f.player.id, client)).toMatchObject([{ team: { race: { tournament: { id: saved.tournamentId } } }, playTimeSeconds: 1200 }])
    expect(await getTfhPlayerResults("no-participation", client)).toEqual([])
    expect(await isTfhTournament(saved.tournamentId, client)).toBe(true)
  })
  it("archives every race as an endurance tournament", async () => {
    const f = await fixture()
    const preview = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    const saved = await saveTfhImport({ draftId: preview.draftId, assignments: preview.assignments.map(a => ({ accountId: a.accountId, playerId: a.playerId! })) }, "admin", client)
    expect((await getTfhRace(saved.tournamentId, client))?.tournament.style).toBe("ENDURANCE")
  })

  it("lists the results of the B2 drivers of every archived edition for the comparison over all editions", async () => {
    const saved: Array<{ player: { id: string }; tournamentId: string }> = []
    for (const event of [20, 21]) {
      const f = await fixture(event)
      const preview = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
      const { tournamentId } = await saveTfhImport({ draftId: preview.draftId, assignments: preview.assignments.map(a => ({ accountId: a.accountId, playerId: a.playerId! })) }, "admin", client)
      saved.push({ player: f.player, tournamentId })
    }
    const results = (await getTfhB2Results(client)).filter(r => saved.some(s => s.player.id === r.playerId))
    expect(results).toHaveLength(2)
    for (const s of saved) {
      expect(results).toContainEqual(expect.objectContaining({
        playerId: s.player.id, checkpoints: 100, playTimeSeconds: 1200, cpm: 5, _count: { finishes: 1 },
        player: expect.objectContaining({ id: s.player.id, name: "Current driver name" }),
        team: expect.objectContaining({ isB2: true, race: expect.objectContaining({ tournamentId: s.tournamentId, kind: "24h" }) }),
      }))
    }
  })
  it("requires the preview owner and all distinct driver assignments before storing anything", async () => {
    const f = await fixture(10)
    const preview = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    const input = { draftId: preview.draftId, assignments: [{ accountId: f.player.tmId, playerId: f.player.id }] }
    await expect(saveTfhImport(input, "other-admin", client)).rejects.toThrow("preview")
    await expect(saveTfhImport({ ...input, assignments: [] }, "admin", client)).rejects.toThrow("Assign")
    await expect(saveTfhImport({ ...input, assignments: [input.assignments[0], input.assignments[0]] }, "admin", client)).rejects.toThrow("Duplicate")
    const unrelated = await client.player.create({ data: { tmId: crypto.randomUUID(), name: "Other", initialName: "Other" } })
    await expect(saveTfhImport({ ...input, assignments: [{ accountId: f.player.tmId, playerId: unrelated.id }] }, "admin", client)).rejects.toThrow("already")
    // An invalid confirmation did not consume the preview or leave half a race.
    const saved = await saveTfhImport(input, "admin", client)
    expect(await getTfhRace(saved.tournamentId, client)).toMatchObject({ sourceEventId: 10 })
  })
  it("updates a race without duplicates, retains explicit account assignments and rejects stale previews", async () => {
    const f = await fixture(11)
    const sourceAccount = crypto.randomUUID()
    const ranking = f.responses["/api/event/11/teams"] as { Teams: Array<{ Players: Array<{ User: { AccountId: string } }> }> }
    const detail = f.responses["/api/event/11/team/1284"] as { Team: { Players: Array<{ User: { AccountId: string }; NumberOfCP: number }> } }
    ranking.Teams[0].Players[0].User.AccountId = sourceAccount
    detail.Team.Players[0].User.AccountId = sourceAccount
    const first = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    const assignment = { accountId: sourceAccount, playerId: f.player.id }
    const saved = await saveTfhImport({ draftId: first.draftId, assignments: [assignment] }, "admin", client)
    const original = await getTfhRace(saved.tournamentId, client)
    detail.Team.Players[0].NumberOfCP = 110
    const next = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    const stale = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    expect(next.assignments).toMatchObject([{ accountId: sourceAccount, playerId: f.player.id }])
    expect(next.changes.some(c => c.before === "100" && c.after === "110")).toBe(true)
    const updated = await saveTfhImport({ draftId: next.draftId, assignments: [assignment] }, "admin", client)
    expect(updated.tournamentId).toBe(saved.tournamentId)
    const current = await getTfhRace(saved.tournamentId, client)
    expect(current?.teams[0].lineupId).toBe(original?.teams[0].lineupId)
    expect(current?.teams[0].drivers).toHaveLength(1)
    expect(current?.teams[0].drivers[0].finishes).toHaveLength(1)
    expect(current?.teams[0].drivers[0].checkpoints).toBe(110)
    await expect(saveTfhImport({ draftId: stale.draftId, assignments: [assignment] }, "admin", client)).rejects.toThrow("changed")
  })
  it("retains a corrected B2 selection and leaves the archive unchanged after invalid assignments", async () => {
    const f = await fixture(12)
    const ranking = f.responses["/api/event/12/teams"] as { Teams: Array<Record<string, unknown>> }
    const secondAccount = crypto.randomUUID()
    ranking.Teams.push({ id: 1285, Name: "Unusual mix", Trigram: "MIX", NumberOfCP: 90, Players: [{ User: { AccountId: secondAccount, DisplayName: "Guest" } }] })
    f.responses["/api/event/12/team/1285"] = { Rank: 2, StartDate: "2025-11-22T14:00:00Z", EndDate: "2025-11-23T14:00:00Z", Team: { id: 1285, Players: [{ User: { AccountId: secondAccount, DisplayName: "Guest" }, NumberOfCP: 90, CalculatedTotalPlayTime: 100, Finishes: [] }] } }
    const preview = await previewTfhImport({ url: f.url, selectedTeamIds: [1285] }, "admin", client, f.fetcher)
    const saved = await saveTfhImport({ draftId: preview.draftId, assignments: [{ accountId: secondAccount, create: { name: "Past guest", status: "FORMER" } }] }, "admin", client)
    const deselectedDetail = f.responses["/api/event/12/team/1284"]
    delete f.responses["/api/event/12/team/1284"]
    const next = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    f.responses["/api/event/12/team/1284"] = deselectedDetail
    expect(next.race.selectedTeamIds).toEqual([1285])
    const race = await getTfhRace(saved.tournamentId, client)
    expect(race?.teams.filter(t => t.isB2)).toMatchObject([{ sourceTeamId: 1285, drivers: [{ player: { name: "Past guest" } }] }])
    const failed = await previewTfhImport({ url: f.url, selectedTeamIds: [1284, 1285] }, "admin", client, f.fetcher)
    await expect(saveTfhImport({ draftId: failed.draftId, assignments: [
      { accountId: f.player.tmId, playerId: "missing-player" }, { accountId: secondAccount, playerId: next.assignments[0].playerId! },
    ] }, "admin", client)).rejects.toThrow("existing")
    expect((await getTfhRace(saved.tournamentId, client))?.revision).toBe(race?.revision)
  })
  it("removes an archived tournament and its dependent source results together", async () => {
    const f = await fixture(13)
    const preview = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    const saved = await saveTfhImport({ draftId: preview.draftId, assignments: [{ accountId: f.player.tmId, playerId: f.player.id }] }, "admin", client)
    await client.tournament.delete({ where: { id: saved.tournamentId } })
    expect(await getTfhRace(saved.tournamentId, client)).toBeNull()
    expect(await getTfhPlayerResults(f.player.id, client)).toEqual([])
  })
  it("recognizes legacy account casing and refuses a duplicate profile for that account", async () => {
    const f = await fixture(14)
    await client.player.update({ where: { id: f.player.id }, data: { tmId: f.player.tmId.toUpperCase() } })
    const preview = await previewTfhImport({ url: f.url }, "admin", client, f.fetcher)
    expect(preview.assignments[0].playerId).toBe(f.player.id)
    await expect(saveTfhImport({ draftId: preview.draftId, assignments: [{ accountId: f.player.tmId, create: { name: "Duplicate", status: "GUEST" } }] }, "admin", client)).rejects.toThrow("already")
  })
})
