import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import type { SessionUser } from "@/lib/lineup-access-db"
import { mayMaintainOpponent } from "@/lib/opponents-access-db"
import { createRosterPlayer, linkOpponentLineups, OpponentError, resolveMatchOpponent, rosterInclude } from "@/lib/opponents-db"
import { opponentNameKey } from "@/lib/opponents"
import { NextResponse } from "next/server"
import { z } from "zod"

const text = z.string().trim().min(1).max(100)
const logo = z.string().max(1_500_000).regex(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/).nullable().optional()
const members = z.array(z.string().min(1)).max(200).optional()
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("team.create"), name: text, logo }),
  z.object({ action: z.literal("team.edit"), id: text, name: text.optional(), logo, archived: z.boolean().optional(), playerIds: members }),
  z.object({ action: z.literal("team.linkLineups"), id: text, lineupIds: z.array(text).min(1).max(200) }),
  z.object({ action: z.literal("team.delete"), id: text }),
  z.object({ action: z.literal("team.merge"), id: text, targetId: text }),
  z.object({ action: z.literal("lineup.create"), tournamentId: text, teamId: text.nullish(), name: text.optional(), previousId: text.optional(), copyRoster: z.boolean().optional() }),
  z.object({ action: z.literal("lineup.edit"), id: text, name: text.optional(), logo, notes: z.string().max(10000).nullable().optional(), archived: z.boolean().optional(), teamId: text.nullish(), playerIds: members }),
  z.object({ action: z.literal("lineup.delete"), id: text }),
  z.object({ action: z.literal("roster.add"), kind: z.enum(["team", "lineup"]), id: text, name: text, country: z.string().regex(/^[a-z]{2}$/).nullish(), playerId: text.optional() }),
])

export async function GET(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const query = new URL(req.url).searchParams
  const competitionId = query.get("competitionId")
  const includeArchive = query.get("archive") === "1"
  const [teams, lineups, tournaments] = await Promise.all([
    db.opponentTeam.findMany({ where: includeArchive ? {} : { archived: false }, include: rosterInclude, orderBy: { name: "asc" } }),
    db.opponentLineup.findMany({ where: { ...(competitionId && { tournamentId: competitionId }), ...(!includeArchive && { archived: false }) }, include: { ...rosterInclude, tournament: { select: { id: true, name: true } }, team: { select: { id: true, name: true, logo: true } }, _count: { select: { matches: true } } }, orderBy: { name: "asc" } }),
    db.tournament.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ])
  return NextResponse.json({ teams, lineups, tournaments })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as SessionUser
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const input = parsed.data
  try {
    let tournamentId: string | undefined
    if (input.action === "lineup.create") tournamentId = input.tournamentId
    if (input.action.startsWith("lineup.") && "id" in input || input.action === "roster.add" && input.kind === "lineup") {
      const l = await db.opponentLineup.findUnique({ where: { id: (input as { id: string }).id } })
      if (!l) throw new OpponentError("Lineup nicht gefunden.", 404)
      tournamentId = l.tournamentId
    }
    if (!(await mayMaintainOpponent(user, tournamentId))) throw new OpponentError("Forbidden", 403)
    if (["team.delete", "team.merge", "lineup.delete"].includes(input.action) && user.role !== "ADMIN") throw new OpponentError("Nur Admins dürfen Einträge löschen oder Teams zusammenführen.", 403)
    if (input.action === "team.linkLineups") {
      const selected = await db.opponentLineup.findMany({ where: { id: { in: input.lineupIds } }, select: { tournamentId: true } })
      for (const competition of new Set(selected.map(l => l.tournamentId))) {
        if (!await mayMaintainOpponent(user, competition)) throw new OpponentError("Forbidden", 403)
      }
    }
    const result = await db.$transaction(async tx => {
      switch (input.action) {
        case "team.create": return tx.opponentTeam.create({ data: { name: input.name, logo: input.logo } })
        case "team.edit": {
          const team = await tx.opponentTeam.findUniqueOrThrow({ where: { id: input.id } })
          return tx.opponentTeam.update({ where: { id: team.id }, data: { name: input.name, logo: input.logo, archived: input.archived, ...(input.name && input.name !== team.name && { aliases: { set: [...new Set([...team.aliases, team.name])] } }), ...(input.playerIds && { slots: { deleteMany: {}, create: [...new Set(input.playerIds)].map(playerId => ({ playerId })) } }) } })
        }
        case "team.linkLineups": return { id: input.id, linked: await linkOpponentLineups(tx, input.id, input.lineupIds) }
        case "team.delete": {
          if (await tx.opponentLineup.count({ where: { teamId: input.id } })) throw new OpponentError("Team hat Competition-Lineups. Bitte archivieren.", 409)
          return tx.opponentTeam.delete({ where: { id: input.id } })
        }
        case "team.merge": {
          if (input.id === input.targetId) throw new OpponentError("Bitte ein anderes Zielteam wählen.")
          const source = await tx.opponentTeam.findUniqueOrThrow({ where: { id: input.id }, include: rosterInclude })
          const target = await tx.opponentTeam.findUniqueOrThrow({ where: { id: input.targetId } })
          await tx.opponentTeam.update({ where: { id: target.id }, data: { aliases: [...new Set([...target.aliases, source.name, ...source.aliases])] } })
          await tx.opponentLineup.updateMany({ where: { teamId: source.id }, data: { teamId: target.id } })
          for (const slot of source.slots) await tx.opponentTeamSlot.upsert({ where: { teamId_playerId: { teamId: target.id, playerId: slot.playerId } }, create: { teamId: target.id, playerId: slot.playerId }, update: {} })
          await tx.opponentTeam.delete({ where: { id: source.id } })
          return target
        }
        case "lineup.create": {
          if (!await tx.tournament.findUnique({ where: { id: input.tournamentId } })) throw new OpponentError("Competition nicht gefunden.", 404)
          if (input.previousId) {
            const previous = await tx.opponentLineup.findUniqueOrThrow({ where: { id: input.previousId }, include: rosterInclude })
            if (previous.tournamentId === input.tournamentId) throw new OpponentError("Bitte eine andere Competition wählen.")
            return tx.opponentLineup.create({ data: { tournamentId: input.tournamentId, teamId: previous.teamId, previousId: previous.id, name: input.name ?? previous.name, nameKey: opponentNameKey(input.name ?? previous.name), slots: { create: input.copyRoster ? previous.slots.map(s => ({ playerId: s.playerId })) : [] } } })
          }
          if (input.teamId && !input.name) return resolveMatchOpponent(tx, input.tournamentId, { teamId: input.teamId })
          const team = input.teamId ? await tx.opponentTeam.findUniqueOrThrow({ where: { id: input.teamId }, include: rosterInclude }) : null
          if (!input.name) throw new OpponentError("Bitte einen Namen angeben.")
          return tx.opponentLineup.create({ data: { tournamentId: input.tournamentId, teamId: team?.id, name: input.name, nameKey: opponentNameKey(input.name), slots: { create: team?.slots.map(s => ({ playerId: s.playerId })) ?? [] } } })
        }
        case "lineup.edit": {
          const l = await tx.opponentLineup.findUniqueOrThrow({ where: { id: input.id } })
          const renamed = input.name && input.name !== l.name
          const updated = await tx.opponentLineup.update({ where: { id: l.id }, data: { name: input.name, ...(input.name && { nameKey: opponentNameKey(input.name) }), ...(renamed && { aliases: [...new Set([...l.aliases, l.name])] }), logo: input.logo, notes: input.notes, archived: input.archived, teamId: input.teamId, ...(input.playerIds && { slots: { deleteMany: {}, create: [...new Set(input.playerIds)].map(playerId => ({ playerId })) } }) } })
          // Renaming a competition participation corrects its name; a later participation is a new row.
          if (renamed) await tx.match.updateMany({ where: { opponentLineupId: l.id }, data: { opponent: input.name } })
          return updated
        }
        case "lineup.delete": {
          if (await tx.match.count({ where: { opponentLineupId: input.id } })) throw new OpponentError("Lineup hat Begegnungen. Bitte archivieren.", 409)
          return tx.opponentLineup.delete({ where: { id: input.id } })
        }
        case "roster.add": {
          const person = input.playerId ? await tx.player.findUniqueOrThrow({ where: { id: input.playerId } }) : await createRosterPlayer(tx, input.name, input.country)
          return input.kind === "team"
            ? tx.opponentTeamSlot.upsert({ where: { teamId_playerId: { teamId: input.id, playerId: person.id } }, create: { teamId: input.id, playerId: person.id }, update: {} })
            : tx.opponentLineupSlot.upsert({ where: { lineupId_playerId: { lineupId: input.id, playerId: person.id } }, create: { lineupId: input.id, playerId: person.id }, update: {} })
        }
      }
    })
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof OpponentError) return NextResponse.json({ error: e.message }, { status: e.status })
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "Dieser Name ist in der Competition bereits vergeben." }, { status: 409 })
    if ((e as { code?: string }).code === "P2025") return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 })
    console.error("Opponent mutation failed", e)
    return NextResponse.json({ error: "Gegnerdaten konnten nicht gespeichert werden." }, { status: 500 })
  }
}
