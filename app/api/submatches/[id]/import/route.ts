import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { parseCSV } from "@/lib/utils"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const subMatch = await db.subMatch.findUnique({
    where: { id },
    include: {
      lineup: { include: { slots: { include: { player: true } } } },
    },
  })
  if (!subMatch) return NextResponse.json({ error: "Sub-match not found" }, { status: 404 })

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

  await db.round.deleteMany({ where: { subMatchId: id } })

  const createdRounds = []
  for (const [roundNumber, roundRows] of roundMap) {
    const track = roundRows[0]?.track ?? null
    const timestamp = roundRows[0]?.time ? new Date(roundRows[0].time * 1000) : null

    const round = await db.round.create({
      data: {
        subMatchId: id,
        number: roundNumber,
        track,
        timestamp,
        results: {
          create: roundRows.map((row) => {
            const isOurTeam = ourTmIds.has(row.playerId.toLowerCase())
            return {
              tmId: row.playerId,
              playerName: row.playerName,
              timeMs: row.record,
              isOurTeam,
              playerId: isOurTeam
                ? subMatch.lineup?.slots.find(
                    (s) => s.player.tmId.toLowerCase() === row.playerId.toLowerCase()
                  )?.player.id ?? null
                : null,
            }
          }),
        },
      },
      include: {
        results: {
          orderBy: { timeMs: "asc" },
          include: { player: { select: { id: true, name: true } } },
        },
      },
    })

    createdRounds.push(round)
  }

  const sortedRounds = createdRounds.sort((a, b) => a.number - b.number)
  return NextResponse.json({ rounds: sortedRounds, imported: rows.length })
}
