import { resolveOpponentPlayer, reopenMatch } from "@/lib/opponents-db"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { parseCSV } from "@/lib/utils"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const subMatch = await db.subMatch.findUnique({
    where: { id },
    include: {
      lineup: { include: { slots: { include: { player: true } } } },
    },
  })
  if (!subMatch) return NextResponse.json({ error: "Sub-match not found" }, { status: 404 })

  // Admins, managers and whoever is responsible for the lineup of this match
  const match = await db.match.findUnique({ where: { id: subMatch.matchId }, select: { tournamentLineupId: true, opponentLineupId: true } })
  if (!(await mayEditLineupById(session.user as SessionUser, match?.tournamentLineupId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const csv: string = body.csv
  if (!csv?.trim()) {
    return NextResponse.json({ error: "No CSV data provided" }, { status: 400 })
  }

  let rows
  try {
    rows = parseCSV(csv)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV contains no data rows" }, { status: 400 })
  }

  const ourTmIds = new Set(
    subMatch.lineup?.slots.map((s) => s.player.tmId.toLowerCase()) ?? []
  )

  const roundMap = new Map<number, typeof rows>()
  for (const row of rows) {
    if (!roundMap.has(row.roundNumber)) {
      roundMap.set(row.roundNumber, [])
    }
    roundMap.get(row.roundNumber)!.push(row)
  }

  const createdRounds = await db.$transaction(async tx => {
    await reopenMatch(tx, subMatch.matchId)
    await tx.round.deleteMany({ where: { subMatchId: id } })
    const createdRounds = []
    const people = new Map<string, Awaited<ReturnType<typeof resolveOpponentPlayer>>>()
    for (const [roundNumber, roundRows] of roundMap) {
      const track = roundRows[0]?.track ?? null
      const timestamp = roundRows[0]?.time ? new Date(roundRows[0].time * 1000) : null

      const results = []
      for (const row of roundRows) {
        const isOurTeam = ourTmIds.has(row.playerId.toLowerCase())
        if (!isOurTeam && !people.has(`${roundNumber}:${row.playerId}`)) people.set(`${roundNumber}:${row.playerId}`, await resolveOpponentPlayer(tx, match?.opponentLineupId ?? null, row.playerId, row.playerName, { subMatchId: subMatch.id, number: roundNumber }))
        const person = people.get(`${roundNumber}:${row.playerId}`)
        results.push({ tmId: person?.tmId ?? row.playerId.toLowerCase(), playerName: row.playerName, timeMs: row.record > 0 ? row.record : null, dnf: row.record <= 0, isOurTeam, playerId: isOurTeam ? subMatch.lineup?.slots.find(s => s.player.tmId.toLowerCase() === row.playerId.toLowerCase())?.player.id ?? null : person?.id ?? null })
      }
      const round = await tx.round.create({
        data: {
          subMatchId: id,
          number: roundNumber,
          track,
          timestamp,
          results: {
            create: results,
          },
        },
        include: {
          results: {
            orderBy: [{ position: "asc" }, { timeMs: "asc" }],
            include: { player: { select: { id: true, name: true } } },
          },
        },
      })

      createdRounds.push(round)
    }

    return createdRounds
  }, { timeout: 30000 })

  const sortedRounds = createdRounds.sort((a, b) => a.number - b.number)
  return NextResponse.json({ rounds: sortedRounds, imported: rows.length })
}
