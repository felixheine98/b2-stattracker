import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { mayMaintainOpponent } from "@/lib/opponents-access-db"
import type { SessionUser } from "@/lib/lineup-access-db"
import { readTeamSheet, copySheetLogo } from "@/lib/opponent-source"
import { createRosterPlayer, linkOpponentLineups, OpponentError, rosterInclude } from "@/lib/opponents-db"
import { opponentNameKey, rosterDifference, findRosterIdentity } from "@/lib/opponents"
import { TEAM_SHEET_ID, TEAM_SHEET_GID, sourcePreviewExclusions, type SheetSource } from "@/lib/opponent-sheet"
import { NextResponse } from "next/server"
import { z } from "zod"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!await mayMaintainOpponent(session.user as SessionUser)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const blocks = await readTeamSheet()
    const teamId = new URL(req.url).searchParams.get("teamId")
    const team = teamId ? await db.opponentTeam.findUnique({ where: { id: teamId }, include: rosterInclude }) : null
    const candidates = await db.opponentLineup.findMany({ where: { teamId: null }, select: { id: true, name: true, teamId: true, tournamentId: true, tournament: { select: { name: true } }, _count: { select: { matches: true } } } })
    const allowed = new Set<string>()
    for (const competition of new Set(candidates.map(l => l.tournamentId))) {
      if (await mayMaintainOpponent(session.user, competition)) allowed.add(competition)
    }
    const unlinkedLineups = candidates.filter(l => allowed.has(l.tournamentId))
    const source = team?.source as SheetSource | null
    const names = source?.blocks?.map(b => b.name) ?? []
    const matched = names.flatMap(n => {
      const candidates = blocks.filter(b => opponentNameKey(b.name) === opponentNameKey(n))
      return candidates.length === 1 ? candidates : []
    })
    return NextResponse.json({ blocks, unlinkedLineups, matchedKeys: matched.map(b => b.key), excluded: sourcePreviewExclusions(blocks, source), needsSelection: names.length > 0 && matched.length !== names.length, difference: team ? rosterDifference(source?.blocks?.flatMap(b => b.members ?? []) ?? team.slots.map(s => s.player), matched.flatMap(b => b.members)) : null, source: team?.source ?? null })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }) }
}
const schema = z.object({
  teamId: z.string().optional(), name: z.string().trim().min(1).max(100),
  blocks: z.array(z.object({ key: z.string(), name: z.string() })).min(1).max(30),
  members: z.array(z.object({ name: z.string(), blockKey: z.string() })).max(300),
  copyName: z.boolean().default(true), copyLogo: z.boolean().default(true), copyRoster: z.boolean().default(true),
  lineupIds: z.array(z.string().min(1)).max(200).default([]),
  keepPlayerIds: z.array(z.string()).max(300).default([]),
})
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!await mayMaintainOpponent(session.user as SessionUser)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const input = parsed.data, current = await readTeamSheet()
    const blocks = input.blocks.map(ref => {
      const exact = current.find(b => b.key === ref.key && b.name === ref.name)
      const named = current.filter(b => b.name === ref.name)
      const block = exact ?? (named.length === 1 ? named[0] : null)
      if (!block) throw new OpponentError("A team block was moved or is ambiguous. Please reload the preview.", 409)
      return { block, originalKey: ref.key }
    })
    const selected = input.members.map(m => {
      const member = blocks.find(b => b.originalKey === m.blockKey)?.block.members.find(p => p.name === m.name)
      if (!member) throw new OpponentError("The roster has changed. Please reload the preview.", 409)
      return member
    }).filter((m, i, arr) => arr.findIndex(p => opponentNameKey(p.name) === opponentNameKey(m.name)) === i)
    const linking = await db.opponentLineup.findMany({ where: { id: { in: input.lineupIds } }, select: { tournamentId: true } })
    for (const competition of new Set(linking.map(l => l.tournamentId))) {
      if (!await mayMaintainOpponent(session.user, competition)) throw new OpponentError("Forbidden", 403)
    }
    const logo = input.copyLogo ? await copySheetLogo(blocks[0].block.logoUrl) : undefined
    const team = await db.$transaction(async tx => {
      const existing = input.teamId ? await tx.opponentTeam.findUniqueOrThrow({ where: { id: input.teamId }, include: rosterInclude }) : null
      const playerIds: string[] = []
      if (input.keepPlayerIds.some(id => !existing?.slots.some(s => s.playerId === id))) throw new OpponentError("Invalid previous roster entry.")
      if (input.copyRoster) playerIds.push(...input.keepPlayerIds)
      if (input.copyRoster) for (const member of selected) {
        const known = findRosterIdentity(existing?.slots.map(s => s.player) ?? [], member.name)
        playerIds.push(known?.id ?? (await createRosterPlayer(tx, member.name, member.country)).id)
      }
      const data = {
        ...(input.copyName && { name: input.name }), ...(input.copyLogo && { logo }),
        ...(existing && input.copyName && input.name !== existing.name && { aliases: [...new Set([...existing.aliases, existing.name])] }),
        source: { sheetId: TEAM_SHEET_ID, gid: TEAM_SHEET_GID, checkedAt: new Date().toISOString(), blocks: blocks.map(({ block }) => ({ key: block.key, name: block.name, row: block.row, column: block.column, members: block.members.map(m => ({ name: m.name, country: m.country })) })), selection: input.copyRoster ? input.members.map(m => ({ name: m.name, blockName: blocks.find(b => b.originalKey === m.blockKey)!.block.name })) : (existing?.source as SheetSource | null)?.selection?.map(p => ({ name: p.name, blockName: p.blockName })) ?? [] },
      }
      const saved = await (existing
        ? tx.opponentTeam.update({ where: { id: existing.id }, data: { ...data, ...(input.copyRoster && { slots: { deleteMany: {}, create: [...new Set(playerIds)].map(playerId => ({ playerId })) } }) } })
        : tx.opponentTeam.create({ data: { ...data, name: input.name, slots: { create: [...new Set(playerIds)].map(playerId => ({ playerId })) } } })
      )
      await linkOpponentLineups(tx, saved.id, input.lineupIds)
      return saved
    })
    return NextResponse.json(team)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof OpponentError ? e.status : 502 })
  }
}
