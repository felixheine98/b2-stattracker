import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "@prisma/client"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolveOpponentPlayer, assignOpponentIdentities, reopenMatch, resolveMatchOpponent, linkOpponentLineups } from "./opponents-db"
import { confirmMatch } from "./match-confirmation"

// Opt-in, real PostgreSQL checks. Every table and fixture lives in a fresh schema;
// neither ordinary test runs nor the integration run alter application data.
describe.skipIf(process.env.OPPONENT_DB_TESTS !== "1")("opponents with PostgreSQL", () => {
  const root = new PrismaClient(), schema = `opponent_test_${crypto.randomUUID().replaceAll("-", "")}`
  let client: PrismaClient
  async function sql(database: PrismaClient, source: string) {
    const statements = source.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(s => s && s !== "BEGIN" && s !== "COMMIT")
    await database.$transaction(async tx => { for (const statement of statements) await tx.$executeRawUnsafe(statement) }, { timeout: 30000 })
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    client = new PrismaClient({ datasourceUrl: url.toString() })
    const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" })
    await sql(client, ddl)
  }, 30000)
  afterAll(async () => { await client?.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect() })

  async function fixture() {
    const own = await client.player.create({ data: { tmId: crypto.randomUUID(), name: "Own", initialName: "Own" } })
    const target = await client.player.create({ data: { tmId: crypto.randomUUID(), name: "Account", initialName: "Account", isOpponentOnly: true } })
    const comp = await client.tournament.create({ data: { name: "Comp", formats: ["ROUND_1V1"], style: "MIXED", stages: { create: { type: "GROUP", number: 1 } } }, include: { stages: true } })
    const lineup = await client.opponentLineup.create({ data: { tournamentId: comp.id, name: "Mix", nameKey: "mix" } })
    const person = await client.$transaction(tx => resolveOpponentPlayer(tx, lineup.id, "ecm-Speedy", "Speedy"))
    const match = await client.match.create({ data: { tournamentId: comp.id, stageId: comp.stages[0].id, opponentLineupId: lineup.id, opponent: "Mix", subMatches: { create: { format: "ROUND_1V1", order: 0, rounds: { create: [0, 1].map(number => ({ number, track: "Map", results: { create: [{ tmId: own.tmId, playerId: own.id, playerName: own.name, isOurTeam: true, position: 1 }, { tmId: person!.tmId, playerId: person!.id, playerName: "Speedy", isOurTeam: false, position: 2 }] } })) } } } }, include: { subMatches: { include: { rounds: { orderBy: { number: "asc" }, include: { results: true } } } } } })
    return { own, target, person: person!, comp, lineup, match, selected: match.subMatches[0].rounds[0].results.find(r => !r.isOurTeam)! }
  }
  it("keeps a selective assignment and its import mapping separate from unselected rounds", async () => {
    const f = await fixture()
    await assignOpponentIdentities({ tmId: f.target.tmId, resultIds: [f.selected.id], rosterPlayerIds: [] }, client)
    expect(await client.roundResult.findUnique({ where: { id: f.selected.id } })).toMatchObject({ playerId: f.target.id, tmId: f.target.tmId })
    expect(await client.roundResult.findFirst({ where: { roundId: f.match.subMatches[0].rounds[1].id, isOurTeam: false } })).toMatchObject({ playerId: f.person.id })
    expect(await client.$transaction(tx => resolveOpponentPlayer(tx, f.lineup.id, "ecm-Speedy", "Speedy", { subMatchId: f.match.subMatches[0].id, number: 0 }))).toMatchObject({ id: f.target.id })
    expect(await client.$transaction(tx => resolveOpponentPlayer(tx, f.lineup.id, "ecm-Speedy", "Speedy", { subMatchId: f.match.subMatches[0].id, number: 1 }))).toMatchObject({ id: f.person.id })
    const other = await client.subMatch.create({ data: { matchId: f.match.id, format: "ROUND_2V2", order: 1 } })
    expect(await client.$transaction(tx => resolveOpponentPlayer(tx, f.lineup.id, "ecm-Speedy", "Speedy", { subMatchId: other.id, number: 0 }))).toMatchObject({ id: f.person.id })
    expect(await client.player.findUnique({ where: { id: f.target.id } })).toMatchObject({ isOpponentOnly: true, opponentNames: ["speedy"] })
  })
  it("rejects identity collisions atomically", async () => {
    const f = await fixture()
    await client.roundResult.create({ data: { roundId: f.selected.roundId, tmId: f.target.tmId, playerName: "Already there", playerId: f.target.id } })
    await expect(assignOpponentIdentities({ tmId: f.target.tmId, resultIds: [f.selected.id], rosterPlayerIds: [] }, client)).rejects.toThrow("bereits belegt")
    expect(await client.roundResult.findUnique({ where: { id: f.selected.id } })).toMatchObject({ playerId: f.person.id })
  })
  it("merges roster identities without losing actual unselected appearances or changing our member status", async () => {
    const f = await fixture()
    const team = await client.opponentTeam.create({ data: { name: "Team", slots: { create: [{ playerId: f.person.id }, { playerId: f.own.id }] } } })
    await client.opponentLineupSlot.create({ data: { lineupId: f.lineup.id, playerId: f.person.id } })
    await assignOpponentIdentities({ tmId: f.own.tmId, resultIds: [], rosterPlayerIds: [f.person.id] }, client)
    expect(await client.opponentTeamSlot.count({ where: { teamId: team.id } })).toBe(1)
    expect(await client.opponentLineupSlot.findFirst({ where: { lineupId: f.lineup.id } })).toMatchObject({ playerId: f.own.id })
    expect(await client.player.findUnique({ where: { id: f.own.id } })).toMatchObject({ isOpponentOnly: false, initialStatus: "MEMBER" })
    expect(await client.roundResult.findUnique({ where: { id: f.selected.id } })).toMatchObject({ playerId: f.person.id })
  })
  it("prefills a team roster once, leaving existing competition snapshots untouched", async () => {
    const f = await fixture()
    const team = await client.opponentTeam.create({ data: { name: "Team", slots: { create: { playerId: f.target.id } } } })
    const created = await client.$transaction(tx => resolveMatchOpponent(tx, f.comp.id, { teamId: team.id }))
    await client.opponentTeamSlot.deleteMany({ where: { teamId: team.id } })
    expect(await client.opponentLineupSlot.count({ where: { lineupId: created!.id, playerId: f.target.id } })).toBe(1)
  })
  it("exposes existing matches under the linked team without changing historical rosters or results", async () => {
    const f = await fixture()
    await client.opponentLineupSlot.create({ data: { lineupId: f.lineup.id, playerId: f.person.id } })
    const team = await client.opponentTeam.create({ data: { name: "Mix", slots: { create: { playerId: f.target.id } } } })
    await client.$transaction(tx => linkOpponentLineups(tx, team.id, [f.lineup.id]))
    expect(await client.match.count({ where: { opponentLineup: { teamId: team.id } } })).toBe(1)
    expect(await client.opponentLineupSlot.findFirst({ where: { lineupId: f.lineup.id } })).toMatchObject({ playerId: f.person.id })
    expect(await client.roundResult.findUnique({ where: { id: f.selected.id } })).toMatchObject({ playerId: f.person.id })
  })
  it("reopens result edits and rejects confirmation of an obsolete revision while preserving the previous audit", async () => {
    const f = await fixture()
    await client.$transaction(tx => confirmMatch(tx, { matchId: f.match.id, revision: 0, outcome: "W", userId: "test" }))
    await client.$transaction(tx => reopenMatch(tx, f.match.id))
    await expect(client.$transaction(tx => confirmMatch(tx, { matchId: f.match.id, revision: 0, outcome: "L", userId: "test" }))).rejects.toThrow("changed")
    expect(await client.match.findUnique({ where: { id: f.match.id } })).toMatchObject({ closedAt: null, confirmedOutcome: null, resultRevision: 1 })
    expect(await client.matchConfirmation.count({ where: { matchId: f.match.id } })).toBe(1)
  })
  it("migrates legacy names per competition and separates real IDs, names and anonymous positions", async () => {
    const legacySchema = `${schema}_legacy`, url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", legacySchema)
    await root.$executeRawUnsafe(`CREATE SCHEMA "${legacySchema}"`)
    const legacy = new PrismaClient({ datasourceUrl: url.toString() })
    try {
      await sql(legacy, `CREATE TABLE "Player" (id TEXT PRIMARY KEY, "tmId" TEXT UNIQUE, name TEXT, "initialName" TEXT, "updatedAt" TIMESTAMP);
      CREATE TABLE "Tournament" (id TEXT PRIMARY KEY);
      CREATE TABLE "Match" (id TEXT PRIMARY KEY, "tournamentId" TEXT, opponent TEXT);
      CREATE TABLE "SubMatch" (id TEXT PRIMARY KEY, "matchId" TEXT);
      CREATE TABLE "Round" (id TEXT PRIMARY KEY, "subMatchId" TEXT);
      CREATE TABLE "RoundResult" (id TEXT PRIMARY KEY, "roundId" TEXT, "playerId" TEXT, "tmId" TEXT, "playerName" TEXT, "isOurTeam" BOOLEAN);
      INSERT INTO "Tournament" VALUES ('c1'),('c2');
      INSERT INTO "Match" VALUES ('m1','c1',' Team  Rockets '),('m2','c1','team rockets'),('m3','c2','Team Rockets');
      INSERT INTO "SubMatch" VALUES ('s1','m1'),('s2','m3');
      INSERT INTO "Round" VALUES ('r1','s1'),('r2','s2');
      INSERT INTO "Player" VALUES ('own','a1234567-1234-1234-1234-123456789012','Member','Member',CURRENT_TIMESTAMP);
      INSERT INTO "RoundResult" VALUES ('real','r1',NULL,'A1234567-1234-1234-1234-123456789012','Member',false),('named1','r1',NULL,'ecm-Speedy','Speedy',false),('named2','r2',NULL,'ecm-Speedy','Speedy',false),('anon','r2',NULL,'opponent-1','Team Rockets',false);`)
      await sql(legacy, readFileSync("prisma/migrations/20261010040000_add_opponents/migration.sql", "utf8"))
      const lineups = await legacy.$queryRaw<Array<{ id: string; tournamentId: string }>>`SELECT id, "tournamentId" FROM "OpponentLineup"`
      expect(lineups).toHaveLength(2)
      const results = await legacy.$queryRaw<Array<{ id: string; playerId: string | null }>>`SELECT id, "playerId" FROM "RoundResult"`
      expect(results.find(r => r.id === "real")?.playerId).toBe("own")
      expect(results.find(r => r.id === "anon")?.playerId).toBeNull()
      expect(results.find(r => r.id === "named1")?.playerId).not.toBe(results.find(r => r.id === "named2")?.playerId)
    } finally { await legacy.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA "${legacySchema}" CASCADE`) }
  })
})
