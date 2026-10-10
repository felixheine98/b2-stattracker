import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"
import { OpponentError, resolveMatchOpponent, opponentMatchInclude } from "@/lib/opponents-db"
import { suggestMatchOutcome } from "@/lib/opponents"
import { confirmMatch } from "@/lib/match-confirmation"
import { syncTournamentSlugs } from "@/lib/slugs-db"
import { NextResponse } from "next/server"
import { z } from "zod"
type Params = { params: Promise<{ id: string; matchId: string }> }
export async function GET(_req: Request, { params }: Params) {
  if (!await auth()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, matchId } = await params
  const match = await db.match.findUnique({ where: { id: matchId, tournamentId: id }, include: { ...opponentMatchInclude, opponentLineup: { include: { team: true } }, confirmations: { orderBy: { createdAt: "desc" } } } })
  if (!match) return NextResponse.json({ error: "Match nicht gefunden." }, { status: 404 })
  const actors = await db.user.findMany({ where: { id: { in: match.confirmations.map(c => c.userId) } }, select: { id: true, name: true } })
  return NextResponse.json({ opponent: match.opponent, opponentLineupId: match.opponentLineupId, opponentLineup: match.opponentLineup, date: match.date, notes: match.notes, closedAt: match.closedAt, confirmedOutcome: match.confirmedOutcome, resultRevision: match.resultRevision, suggestedOutcome: suggestMatchOutcome(match.subMatches), confirmations: match.confirmations.map(c => ({ ...c, actor: actors.find(u => u.id === c.userId)?.name ?? (c.userId.startsWith("system:") ? "System · Sammelabschluss" : "Gelöschter Account") })) })
}
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), opponent: z.string().trim().max(100).nullish(), opponentLineupId: z.string().nullish(), opponentTeamId: z.string().nullish(), date: z.string().date().nullish(), notes: z.string().max(10000).nullish(), alias: z.string().trim().min(1).max(100).optional() }),
  z.object({ action: z.literal("confirm"), revision: z.number().int().min(0), outcome: z.enum(["W", "L", "D"]) }),
  z.object({ action: z.literal("reopen") }),
])
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, matchId } = await params
  const match = await db.match.findUnique({ where: { id: matchId, tournamentId: id }, include: { stage: true } })
  if (!match) return NextResponse.json({ error: "Match nicht gefunden." }, { status: 404 })
  if (!await mayEditLineupById(session.user as SessionUser, match.tournamentLineupId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const input = parsed.data
    await db.$transaction(async tx => {
      if (input.action === "confirm") {
        if (match.stage.type === "SEEDING") throw new OpponentError("Seeding zählt nicht zur Gegnerbilanz.")
        await confirmMatch(tx, { matchId, revision: input.revision, outcome: input.outcome, userId: (session.user as { id: string }).id })
      } else if (input.action === "reopen") {
        await tx.match.update({ where: { id: matchId }, data: { closedAt: null, confirmedOutcome: null } })
      } else {
        const hasSelection = input.opponent !== undefined || input.opponentLineupId !== undefined || input.opponentTeamId !== undefined
        const opponent = match.stage.type === "SEEDING" ? null : hasSelection ? await resolveMatchOpponent(tx, id, { lineupId: input.opponentLineupId, teamId: input.opponentTeamId, name: input.opponent }) : match.opponentLineupId ? await tx.opponentLineup.findUnique({ where: { id: match.opponentLineupId } }) : null
        if (input.alias && opponent) await tx.opponentLineup.update({ where: { id: opponent.id }, data: { aliases: [...new Set([...opponent.aliases, input.alias])] } })
        await tx.match.update({ where: { id: matchId }, data: { opponent: opponent?.name ?? null, opponentLineupId: opponent?.id ?? null, date: input.date === undefined ? undefined : input.date ? new Date(input.date) : null, notes: input.notes === undefined ? undefined : input.notes ?? null } })
      }
    })
    if (input.action === "edit") await syncTournamentSlugs(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof OpponentError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Match konnte nicht gespeichert werden." }, { status: 500 })
  }
}
