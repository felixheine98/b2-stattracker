import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { teamSize } from "@/lib/utils"

interface Params {
  params: Promise<{ id: string }>
}

// positions[i] and times[i] belong to playerIds[i]; source is the number of the
// existing round this one was edited from, so its opponent results can be kept
const schema = z.object({
  playerIds: z.array(z.string()).min(1),
  rounds: z.array(
    z.object({
      positions: z.array(z.number().int().min(1)),
      times: z.array(z.number().int().positive().nullable()).optional(),
      source: z.number().int().nullish(),
    })
  ),
  track: z.string().trim().max(100).nullish(),
})

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const subMatch = await db.subMatch.findUnique({
    where: { id },
    include: { match: { select: { opponent: true } } },
  })
  if (!subMatch) return NextResponse.json({ error: "Sub-match not found" }, { status: 404 })

  const size = teamSize(subMatch.format)
  if (!size) return NextResponse.json({ error: "Manual round entry is not available for this format" }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { playerIds, rounds } = parsed.data
  const track = parsed.data.track || null
  const maxPosition = size * 2

  if (playerIds.length !== size || new Set(playerIds).size !== size) {
    return NextResponse.json({ error: `Exactly ${size} different players are required` }, { status: 400 })
  }
  for (const [i, { positions, times }] of rounds.entries()) {
    const valid =
      positions.length === size &&
      new Set(positions).size === size &&
      positions.every((p) => p <= maxPosition) &&
      (!times || times.length === size)
    if (!valid) return NextResponse.json({ error: `Round ${i + 1} has invalid placements` }, { status: 400 })
  }

  const players = await db.player.findMany({ where: { id: { in: playerIds } } })
  if (players.length !== size) return NextResponse.json({ error: "Unknown player" }, { status: 400 })
  const playerById = new Map(players.map((p) => [p.id, p]))
  const opponentName = subMatch.match.opponent || "Gegner"

  const existing = await db.round.findMany({
    where: { subMatchId: id },
    include: { results: { where: { isOurTeam: false }, orderBy: [{ position: "asc" }, { timeMs: "asc" }] } },
  })
  const existingByNumber = new Map(existing.map((r) => [r.number, r]))

  await db.$transaction([
    db.round.deleteMany({ where: { subMatchId: id } }),
    ...rounds.map(({ positions, times, source }, number) => {
      // Placements not taken by our players belong to the opponent
      const opponentPositions = Array.from({ length: maxPosition }, (_, i) => i + 1).filter(
        (p) => !positions.includes(p)
      )
      // Keep known opponents (names and times from an import) in their previous order
      const previous = source != null ? existingByNumber.get(source) : undefined
      const knownOpponents = previous?.results.length === opponentPositions.length ? previous.results : null
      return db.round.create({
        data: {
          subMatchId: id,
          number,
          track,
          timestamp: previous?.timestamp ?? null,
          results: {
            create: [
              ...positions.map((position, i) => {
                const player = playerById.get(playerIds[i])!
                return {
                  tmId: player.tmId,
                  playerName: player.name,
                  playerId: player.id,
                  position,
                  timeMs: times?.[i] ?? null,
                  isOurTeam: true,
                }
              }),
              ...opponentPositions.map((position, i) => ({
                tmId: knownOpponents?.[i].tmId ?? `opponent-${position}`,
                playerName: knownOpponents?.[i].playerName ?? opponentName,
                timeMs: knownOpponents?.[i].timeMs ?? null,
                position,
                isOurTeam: false,
              })),
            ],
          },
        },
      })
    }),
  ])

  const saved = await db.round.findMany({
    where: { subMatchId: id },
    orderBy: { number: "asc" },
    include: {
      results: {
        orderBy: [{ position: "asc" }, { timeMs: "asc" }],
        include: { player: { select: { id: true, name: true } } },
      },
    },
  })

  return NextResponse.json({ rounds: saved })
}
