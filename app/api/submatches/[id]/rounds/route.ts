import { withCompNames } from "@/lib/player-names-db"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"
import { teamSize } from "@/lib/utils"

interface Params {
  params: Promise<{ id: string }>
}

// positions[i] and times[i] belong to playerIds[i]; source is the number of the
// existing round this one was edited from, so its opponent results can be kept.
// opponents lists the opposing players in finishing order (used by imports).
// dnf[i] marks players who did not finish, opponentDnfs counts those of the opponent
// (their last places); ecmUrl is the eCircuitMania page of an import.
const schema = z.object({
  playerIds: z.array(z.string()).min(1),
  rounds: z.array(
    z.object({
      positions: z.array(z.number().int().min(1)),
      times: z.array(z.number().int().positive().nullable()).optional(),
      dnf: z.array(z.boolean()).optional(),
      opponentDnfs: z.number().int().min(0).optional(),
      source: z.number().int().nullish(),
      opponents: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(100),
            timeMs: z.number().int().positive().nullable(),
            dnf: z.boolean().optional(),
          })
        )
        .optional(),
    })
  ),
  track: z.string().trim().max(100).nullish(),
  ecmUrl: z
    .string()
    .url()
    .max(500)
    .refine((u) => /^https:\/\/([a-z0-9-]+\.)*ecircuitmania\.com\//i.test(u), "Not an eCircuitMania address")
    .optional(),
})

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const subMatch = await db.subMatch.findUnique({
    where: { id },
    include: { match: { select: { opponent: true, tournamentLineupId: true, tournament: { select: { startDate: true, createdAt: true } } } } },
  })
  if (!subMatch) return NextResponse.json({ error: "Sub-match not found" }, { status: 404 })
  // Admins, managers and whoever is responsible for the lineup of this match
  if (!(await mayEditLineupById(session.user as SessionUser, subMatch.match.tournamentLineupId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const size = teamSize(subMatch.format)
  if (!size) return NextResponse.json({ error: "Manual round entry is not available for this format" }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { playerIds, rounds, ecmUrl } = parsed.data
  const track = parsed.data.track || null
  const maxPosition = size * 2

  if (playerIds.length !== size || new Set(playerIds).size !== size) {
    return NextResponse.json({ error: `Exactly ${size} different players are required` }, { status: 400 })
  }
  for (const [i, { positions, times, dnf, opponentDnfs, opponents }] of rounds.entries()) {
    // Everyone who finished is placed ahead of everyone who did not
    const finishers =
      maxPosition - (dnf?.filter(Boolean).length ?? 0) - (opponentDnfs ?? opponents?.filter((o) => o.dnf).length ?? 0)
    const valid =
      positions.length === size &&
      new Set(positions).size === size &&
      positions.every((p) => p <= maxPosition) &&
      (!times || times.length === size) &&
      (!dnf || dnf.length === size) &&
      (opponentDnfs ?? 0) <= size &&
      positions.every((p, j) => (dnf?.[j] ? p > finishers : p <= finishers)) &&
      (!opponents || (opponents.length === size && new Set(opponents.map((o) => o.name)).size === size))
    if (!valid) return NextResponse.json({ error: `Round ${i + 1} has invalid placements` }, { status: 400 })
  }

  const players = await db.player.findMany({ where: { id: { in: playerIds } } })
  if (players.length !== size) return NextResponse.json({ error: "Unknown player" }, { status: 400 })
  const playerById = new Map(players.map((p) => [p.id, p]))
  const opponentName = subMatch.match.opponent || "Gegner"

  const existing = await db.round.findMany({
    where: { subMatchId: id },
    include: { results: { orderBy: [{ position: "asc" }, { timeMs: "asc" }] } },
  })
  const existingByNumber = new Map(existing.map((r) => [r.number, r]))

  await db.$transaction([
    db.round.deleteMany({ where: { subMatchId: id } }),
    ...(ecmUrl ? [db.match.update({ where: { id: subMatch.matchId }, data: { ecmUrl } })] : []),
    ...rounds.map(({ positions, times, dnf, opponentDnfs, source, opponents }, number) => {
      // Placements not taken by our players belong to the opponent
      const opponentPositions = Array.from({ length: maxPosition }, (_, i) => i + 1).filter(
        (p) => !positions.includes(p)
      )
      // Keep known opponents (names and times from an import) in their previous order
      const previous = source != null ? existingByNumber.get(source) : undefined
      const previousOpponents = previous?.results.filter((r) => !r.isOurTeam) ?? []
      const knownOpponents = previousOpponents.length === opponentPositions.length ? previousOpponents : null
      const opponentDnf = (i: number) =>
        opponents ? opponents[i].dnf ?? false
        : opponentDnfs != null ? i >= size - opponentDnfs
        : knownOpponents?.[i].dnf ?? false
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
                  timeMs: dnf?.[i] ? null : times?.[i] ?? null,
                  dnf: dnf?.[i] ?? false,
                  isOurTeam: true,
                }
              }),
              ...opponentPositions.map((position, i) => ({
                tmId: opponents ? `ecm-${opponents[i].name}` : knownOpponents?.[i].tmId ?? `opponent-${position}`,
                playerName: opponents?.[i].name ?? knownOpponents?.[i].playerName ?? opponentName,
                timeMs: opponentDnf(i) ? null : opponents ? opponents[i].timeMs : knownOpponents?.[i].timeMs ?? null,
                dnf: opponentDnf(i),
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

  return NextResponse.json({ rounds: await withCompNames(saved, subMatch.match.tournament) })
}
