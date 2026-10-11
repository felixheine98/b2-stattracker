import { OpponentError, resolveMatchOpponent } from "@/lib/opponents-db"
import { syncTournamentSlugs } from "@/lib/slugs-db"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { nextMatchNumber } from "@/lib/match-order"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const matches = await db.match.findMany({
    where: { tournamentId: id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { subMatches: true } },
    },
  })

  return NextResponse.json(matches)
}

const createSchema = z.object({
  stageId: z.string().min(1),
  opponent: z.string().trim().max(100).nullable().optional(),
  opponentLineupId: z.string().nullable().optional(),
  opponentTeamId: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Left out: the next number of the lineup is taken; null: the match stays without a number
  number: z.number().int().min(1).max(999).nullable().optional(),
  label: z.string().trim().max(60).nullable().optional(),
  // Every match belongs to a lineup of the tournament
  lineupId: z.string().min(1),
})

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const stage = await db.stage.findUnique({ where: { id: parsed.data.stageId } })
  if (!stage || stage.tournamentId !== id) return NextResponse.json({ error: "Stage not found" }, { status: 400 })

  const tl = await db.tournamentLineup.findUnique({
    where: { id: parsed.data.lineupId, tournamentId: id },
    include: { slots: { select: { playerId: true } } },
  })
  if (!tl) return NextResponse.json({ error: "Lineup not found" }, { status: 400 })
  // Admins, managers and whoever is responsible for this lineup
  if (!(await mayEditLineupById(session.user as SessionUser, tl.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const lineupPlayerIds = tl.slots.map((s) => s.playerId)

  const subMatchFormats = stage.type === "SEEDING"
    ? [{ format: "TIME_ATTACK_10" as const, order: 0 }]
    : tournament.formats
        .filter((f) => f !== "TIME_ATTACK_10")
        .map((f, i) => ({ format: f, order: i }))

  const lineupCreate = lineupPlayerIds.length > 0
    ? { create: { slots: { create: lineupPlayerIds.map((playerId) => ({ playerId })) } } }
    : undefined

  let match
  try {
  match = await db.$transaction(async tx => {
  const opponent = stage.type === "SEEDING" ? null : await resolveMatchOpponent(tx, id, { lineupId: parsed.data.opponentLineupId, teamId: parsed.data.opponentTeamId, name: parsed.data.opponent })
  return tx.match.create({
    data: {
      tournamentId: id,
      stageId: stage.id,
      opponent: opponent?.name ?? null,
      opponentLineupId: opponent?.id ?? null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      notes: parsed.data.notes ?? null,
      number:
        parsed.data.number !== undefined
          ? parsed.data.number
          : nextMatchNumber(await tx.match.findMany({ where: { tournamentLineupId: tl.id }, select: { number: true } })),
      label: parsed.data.label || null,
      tournamentLineupId: tl.id,
      subMatches: {
        create: subMatchFormats.map((sm) => ({ ...sm, lineup: lineupCreate })),
      },
    },
    include: { _count: { select: { subMatches: true } }, stage: { select: { id: true, type: true } }, subMatches: { include: { rounds: { include: { results: true } } } } },
  })

  })
  } catch (e) {
    if (e instanceof OpponentError) return NextResponse.json({ error: e.message }, { status: e.status })
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "The opponent was created at the same time. Please pick it again." }, { status: 409 })
    throw e
  }

  await syncTournamentSlugs(id)
  const { slug } = await db.match.findUniqueOrThrow({ where: { id: match.id }, select: { slug: true } })

  return NextResponse.json({ ...match, slug }, { status: 201 })
}
