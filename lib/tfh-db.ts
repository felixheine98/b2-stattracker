import { Prisma, type PrismaClient } from "@prisma/client"
import { db } from "./db"
import { loadTfhRace, tfhSourceUrl, type TfhRaceData } from "./tfh"
import { z } from "zod"

export const tfhSaveSchema = z.object({
  draftId: z.string().min(1),
  assignments: z.array(z.object({
    accountId: z.string().uuid().transform(v => v.toLowerCase()), playerId: z.string().min(1).optional(),
    create: z.object({ name: z.string().trim().min(1).max(100), status: z.enum(["MEMBER", "TRIAL", "GUEST", "FORMER"]) }).optional(),
  }).refine(a => !!a.playerId !== !!a.create, "Assign each driver to a player or create a player.")).max(200),
})

export interface TfhAssignment {
  accountId: string
  playerId?: string
  create?: { name: string; status: "MEMBER" | "TRIAL" | "GUEST" | "FORMER" }
}
export interface TfhPreview {
  draftId: string; race: TfhRaceData; existingTournamentId: string | null
  assignments: Array<{ accountId: string; sourceName: string; playerId: string | null }>
  changes: Array<{ label: string; before: string; after: string }>
}

export async function previewTfhImport(input: { url: string; selectedTeamIds?: number[] }, ownerId: string, database: PrismaClient = db, fetcher: typeof fetch = fetch): Promise<TfhPreview> {
  const previousSelection = input.selectedTeamIds === undefined ? await database.tfhRace.findFirst({ where: { sourceUrl: tfhSourceUrl(input.url) }, select: { teams: { where: { isB2: true }, select: { sourceTeamId: true } } } }) : null
  let race = await loadTfhRace(input.url, input.selectedTeamIds ?? previousSelection?.teams.map(t => t.sourceTeamId), fetcher)
  const existing = await database.tfhRace.findUnique({ where: { sourceEventId: race.sourceEventId }, include: { identities: true, teams: { include: { drivers: { include: { finishes: { orderBy: { number: "asc" } } } } } }, tournament: true } })
  if (existing && input.selectedTeamIds === undefined) {
    const selected = existing.teams.filter(t => t.isB2).map(t => t.sourceTeamId)
    if (JSON.stringify([...selected].sort()) !== JSON.stringify([...race.selectedTeamIds].sort())) race = await loadTfhRace(input.url, selected, fetcher)
  }
  const players = await database.player.findMany({ where: { isOpponentOnly: false }, select: { id: true, tmId: true } })
  const assignments = [...new Map(race.teams.flatMap(t => t.drivers).map(d => [d.accountId, d])).values()].map(d => ({ accountId: d.accountId, sourceName: d.name, playerId: existing?.identities.find(a => a.accountId === d.accountId && players.some(p => p.id === a.playerId))?.playerId ?? players.find(p => p.tmId.toLowerCase() === d.accountId)?.id ?? null }))
  const changes: TfhPreview["changes"] = []
  const note = (label: string, before: unknown, after: unknown) => {
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ label, before: before == null ? "—" : String(before), after: after == null ? "—" : String(after) })
  }
  if (existing) {
    note("Race name", existing.tournament.name, race.name)
    note("Map", existing.mapName, race.mapName)
    note("Start", existing.tournament.startDate?.toISOString(), new Date(race.startDate).toISOString())
    note("End", existing.tournament.endDate?.toISOString(), new Date(race.endDate).toISOString())
    for (const t of race.teams) {
      const old = existing.teams.find(o => o.sourceTeamId === t.sourceTeamId)
      if (!old) { note(t.name, null, "New team"); continue }
      for (const key of ["name", "tag", "rank", "checkpoints", "lastCpMs"] as const) note(`${t.name} · ${key}`, old[key], t[key])
      note(`${t.name} · B2`, old.isB2, race.selectedTeamIds.includes(t.sourceTeamId))
      for (const d of t.drivers) {
        const prior = old.drivers.find(o => o.accountId === d.accountId)
        if (!prior) { note(`${t.name} · ${d.name}`, null, "New driver"); continue }
        note(`${t.name} · ${d.name} · name`, prior.sourceName, d.name)
        for (const key of ["checkpoints", "playTimeSeconds", "cpm", "bestLapMs", "averageLapMs", "bestSplits", "averageSplits"] as const) note(`${t.name} · ${d.name} · ${key}`, prior[key], d[key])
        const finishes = prior.finishes.map(f => ({ timestamp: f.timestamp.toISOString(), timeMs: f.timeMs, sourceRank: f.sourceRank, sourceType: f.sourceType }))
        const incoming = d.finishes.map(f => ({ ...f, timestamp: new Date(f.timestamp).toISOString() }))
        if (JSON.stringify(finishes) !== JSON.stringify(incoming)) changes.push({ label: `${t.name} · ${d.name} · finishes`, before: `${finishes.length} finishes`, after: `${incoming.length} finishes (updated)` })
      }
      for (const d of old.drivers) if (!t.drivers.some(p => p.accountId === d.accountId)) note(`${t.name} · ${d.sourceName}`, "Driver details", "Removed")
    }
    for (const t of existing.teams) if (!race.teams.some(o => o.sourceTeamId === t.sourceTeamId)) note(t.name, "Team", "Removed")
  }
  await database.tfhImportDraft.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  const draft = await database.tfhImportDraft.create({ data: { ownerId, sourceEventId: race.sourceEventId, baseRevision: existing?.revision ?? 0, payload: race as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 30 * 60000) } })
  return { draftId: draft.id, race, existingTournamentId: existing?.tournamentId ?? null, assignments, changes }
}

export async function saveTfhImport(input: { draftId: string; assignments: TfhAssignment[] }, ownerId: string, database: PrismaClient = db) {
  input = tfhSaveSchema.parse(input)
  return database.$transaction(async tx => {
    const draft = await tx.tfhImportDraft.findUnique({ where: { id: input.draftId } })
    if (!draft || draft.ownerId !== ownerId || draft.expiresAt <= new Date()) throw new Error("This preview has expired or belongs to another user. Reload the preview.")
    const data = draft.payload as unknown as TfhRaceData
    const existing = await tx.tfhRace.findUnique({ where: { sourceEventId: data.sourceEventId }, include: { teams: true } })
    if ((existing?.revision ?? 0) !== draft.baseRevision) throw new Error("This race has changed since the preview. Reload the preview.")
    const drivers = [...new Map(data.teams.flatMap(t => t.drivers).map(d => [d.accountId, d])).values()]
    if (new Set(input.assignments.map(a => a.accountId)).size !== input.assignments.length) throw new Error("Duplicate driver assignments.")
    if (!data.selectedTeamIds.length || input.assignments.length !== drivers.length || drivers.some(d => !input.assignments.some(a => a.accountId === d.accountId))) throw new Error("Assign every B2 driver before saving.")
    const players = new Map<string, string>()
    for (const assignment of input.assignments) {
      const known = await tx.player.findFirst({ where: { tmId: { equals: assignment.accountId, mode: "insensitive" } } })
      if (assignment.playerId) {
        const chosen = await tx.player.findUnique({ where: { id: assignment.playerId } })
        if (!chosen || chosen.isOpponentOnly) throw new Error("Choose an existing team player or create a player with an explicit status.")
        if (known && !known.isOpponentOnly && known.id !== chosen.id) throw new Error("This account already belongs to another player.")
        players.set(assignment.accountId, chosen.id)
      }
      else if (assignment.create) {
        if (known && !known.isOpponentOnly) throw new Error("This account already has a player profile.")
        const playerData = { tmId: assignment.accountId, name: assignment.create.name, initialName: assignment.create.name, initialStatus: assignment.create.status, isOpponentOnly: false }
        const player = known ? await tx.player.update({ where: { id: known.id }, data: playerData }) : await tx.player.create({ data: playerData })
        players.set(assignment.accountId, player.id)
      }
    }
    for (const team of data.teams) if (new Set(team.drivers.map(d => players.get(d.accountId))).size !== team.drivers.length) throw new Error("Duplicate players in a B2 team. Check the assignments.")
    const tournamentData = { name: data.name, formats: [], startDate: new Date(data.startDate), endDate: new Date(data.endDate) }
    const tournament = existing ? await tx.tournament.update({ where: { id: existing.tournamentId }, data: tournamentData }) : await tx.tournament.create({ data: tournamentData })
    const raceData = { sourceUrl: data.sourceUrl, kind: data.kind, mapName: data.mapName, importedAt: new Date() }
    const race = existing ? await tx.tfhRace.update({ where: { id: existing.id }, data: { ...raceData, revision: { increment: 1 } } }) : await tx.tfhRace.create({ data: { ...raceData, sourceEventId: data.sourceEventId, tournamentId: tournament.id } })
    for (const [accountId, playerId] of players) await tx.tfhIdentity.upsert({ where: { raceId_accountId: { raceId: race.id, accountId } }, create: { raceId: race.id, accountId, playerId }, update: { playerId } })
    for (const old of existing?.teams ?? []) if (!data.teams.some(t => t.sourceTeamId === old.sourceTeamId)) {
      await tx.tfhTeam.delete({ where: { id: old.id } })
      if (old.lineupId) await tx.tournamentLineup.delete({ where: { id: old.lineupId } })
    }
    for (const team of data.teams) {
      const isB2 = data.selectedTeamIds.includes(team.sourceTeamId)
      const old = existing?.teams.find(t => t.sourceTeamId === team.sourceTeamId)
      const slots = team.drivers.map(d => ({ playerId: players.get(d.accountId)! }))
      const lineup = isB2 ? old?.lineupId
        ? await tx.tournamentLineup.update({ where: { id: old.lineupId }, data: { name: team.name, slots: { deleteMany: {}, create: slots } } })
        : await tx.tournamentLineup.create({ data: { tournamentId: tournament.id, name: team.name, slots: { create: slots } } }) : null
      if (old) await tx.tfhDriver.deleteMany({ where: { teamId: old.id } })
      const teamData = {
        raceId: race.id, sourceTeamId: team.sourceTeamId, name: team.name, tag: team.tag, rank: team.rank, checkpoints: team.checkpoints, lastCpMs: team.lastCpMs, isB2, lineupId: lineup?.id,
        drivers: { create: team.drivers.map(d => ({
          accountId: d.accountId, sourceName: d.name, playerId: players.get(d.accountId)!, checkpoints: d.checkpoints, playTimeSeconds: d.playTimeSeconds, cpm: d.cpm,
          bestLapMs: d.bestLapMs, averageLapMs: d.averageLapMs, bestSplits: d.bestSplits, averageSplits: d.averageSplits,
          finishes: { create: d.finishes.map((f, number) => ({ ...f, number, timestamp: new Date(f.timestamp) })) },
        })) },
      }
      if (old) await tx.tfhTeam.update({ where: { id: old.id }, data: { ...teamData, lineupId: lineup?.id ?? null } })
      else await tx.tfhTeam.create({ data: teamData })
      if (old?.lineupId && !isB2) await tx.tournamentLineup.delete({ where: { id: old.lineupId } })
    }
    await tx.tfhImportDraft.delete({ where: { id: draft.id } })
    return { tournamentId: tournament.id }
  }, { timeout: 30000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function getTfhRace(tournamentId: string, database: PrismaClient = db) {
  return database.tfhRace.findUnique({ where: { tournamentId }, include: {
    tournament: true,
    teams: { orderBy: { rank: "asc" }, include: {
      lineup: { include: { slots: true } },
      drivers: { orderBy: { sourceName: "asc" }, include: { player: { select: { id: true, slug: true, name: true } }, finishes: { orderBy: { number: "asc" } } } },
    } },
  } })
}

export async function getTfhPlayerResults(playerId: string, database: PrismaClient = db) {
  return database.tfhDriver.findMany({ where: { playerId }, orderBy: { team: { race: { tournament: { startDate: "desc" } } } }, include: { team: { include: { lineup: true, race: { include: { tournament: true } } } } } })
}

// The results of all B2 drivers over all archived editions, for the totals over several editions
// (editions, play time, checkpoints, finishes and the pace from them). Drivers are only stored for teams selected as B2.
export async function getTfhB2Results(database: PrismaClient = db) {
  return database.tfhDriver.findMany({
    where: { team: { isB2: true } },
    select: {
      playerId: true, checkpoints: true, playTimeSeconds: true, _count: { select: { finishes: true } },
      player: { select: { id: true, slug: true, name: true } },
      team: { select: { isB2: true, race: { select: { id: true, tournamentId: true, kind: true } } } },
    },
  })
}

export async function isTfhTournament(tournamentId: string, database: PrismaClient = db) {
  return (await database.tfhRace.count({ where: { tournamentId } })) > 0
}
