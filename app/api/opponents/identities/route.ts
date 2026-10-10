import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { assignOpponentIdentities, OpponentError } from "@/lib/opponents-db"
import { confirmedTmId, opponentNameKey } from "@/lib/opponents"
import { fetchTmioPlayer, TmioError } from "@/lib/tmio"
import { NextResponse } from "next/server"
import { z } from "zod"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const name = new URL(req.url).searchParams.get("name")?.trim()
  if (!name || name.length > 100) return NextResponse.json({ error: "Bitte einen Namen angeben." }, { status: 400 })
  const matchingPeople = await db.player.findMany({ where: { OR: [{ name: { equals: name, mode: "insensitive" } }, { initialName: { equals: name, mode: "insensitive" } }, { opponentNames: { has: opponentNameKey(name) } }] }, include: { opponentTeamSlots: { include: { team: { select: { name: true } } } }, opponentLineupSlots: { include: { lineup: { select: { name: true, tournament: { select: { name: true } } } } } } } })
  const results = await db.roundResult.findMany({ where: { isOurTeam: false, OR: [{ playerName: { equals: name, mode: "insensitive" } }, { playerId: { in: matchingPeople.map(p => p.id) } }] }, include: { player: { select: { name: true, tmId: true } }, round: { select: { number: true, track: true, subMatch: { select: { match: { select: { opponent: true, tournament: { select: { name: true } }, opponentLineupId: true } } } } } } }, orderBy: { id: "asc" } })
  const rosterPlayers = matchingPeople.filter(p => p.isOpponentOnly && (p.opponentTeamSlots.length || p.opponentLineupSlots.length))
  return NextResponse.json({ results: results.filter(r => !r.tmId.startsWith("opponent-")), rosterPlayers, confirmed: results.filter(r => confirmedTmId(r.tmId)).length })
}
const schema = z.object({ tmId: z.string().uuid().transform(v => v.toLowerCase()), resultIds: z.array(z.string()).max(10000).default([]), rosterPlayerIds: z.array(z.string()).max(500).default([]) })
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  if (!parsed.data.resultIds.length && !parsed.data.rosterPlayerIds.length) return NextResponse.json({ error: "Bitte Auftritte oder Kadereinträge auswählen." }, { status: 400 })
  try {
    const remote = await fetchTmioPlayer(parsed.data.tmId)
    if (!remote) return NextResponse.json({ error: "Account nicht gefunden." }, { status: 404 })
    await db.player.upsert({ where: { tmId: remote.id }, update: {}, create: { tmId: remote.id, name: remote.name, initialName: remote.name, country: remote.country, isOpponentOnly: true } })
    return NextResponse.json(await assignOpponentIdentities(parsed.data))
  } catch (e) {
    if (e instanceof OpponentError || e instanceof TmioError) return NextResponse.json({ error: e.message }, { status: e.status })
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "Der Account ist in einer ausgewählten Runde bereits belegt." }, { status: 409 })
    console.error("Identity assignment failed", e)
    return NextResponse.json({ error: "Zuordnung fehlgeschlagen." }, { status: 500 })
  }
}
