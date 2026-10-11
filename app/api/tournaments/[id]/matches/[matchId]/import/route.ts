import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"
import { confirmedTmId } from "@/lib/opponents"
import { saveMatchImport } from "@/lib/match-import-db"
import { canManage } from "@/lib/roles"
import { syncPlayerSlugs } from "@/lib/slugs-db"
import { NextResponse } from "next/server"
import { z } from "zod"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

// What the import dialog worked out from the dumper's CSV (see lib/match-csv.ts): per sub-match
// the rounds to save, every result in finishing order and on its side. guests are drivers of
// ours who are not in the system yet.
const schema = z.object({
  blocks: z
    .array(
      z.object({
        subMatchId: z.string(),
        track: z.string().trim().max(100).nullish(),
        rounds: z
          .array(
            z.object({
              time: z.number().int().nonnegative(),
              results: z
                .array(
                  z.object({
                    tmId: z.string().min(1).max(100),
                    name: z.string().trim().min(1).max(100),
                    timeMs: z.number().int().positive().nullable(),
                    dnf: z.boolean(),
                    isOurTeam: z.boolean(),
                  })
                )
                .min(1)
                .max(20),
            })
          )
          .min(1)
          .max(200),
      })
    )
    .min(1),
  guests: z.array(z.object({ tmId: z.string(), name: z.string().trim().min(1).max(100) })).default([]),
})

// Fill the sub-matches of a match from an import of the whole match. Rounds a sub-match
// already has are replaced; sub-matches that are not named stay as they are.
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, matchId } = await params
  const match = await db.match.findFirst({
    where: { id: matchId, tournamentId: id },
    select: { id: true, tournamentLineupId: true, opponentLineupId: true, subMatches: { select: { id: true } } },
  })
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  // Admins, managers and whoever is responsible for the lineup of this match
  const user = session.user as SessionUser
  if (!(await mayEditLineupById(user, match.tournamentLineupId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid import data" }, { status: 400 })
  const { blocks, guests } = parsed.data

  const subMatchIds = blocks.map((b) => b.subMatchId)
  if (new Set(subMatchIds).size !== subMatchIds.length || subMatchIds.some((s) => !match.subMatches.some((sm) => sm.id === s))) {
    return NextResponse.json({ error: "Every block needs a sub-match of its own in this match" }, { status: 400 })
  }
  for (const block of blocks) {
    for (const round of block.rounds) {
      const ids = round.results.map((r) => r.tmId.toLowerCase())
      if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "A driver appears twice in a round" }, { status: 400 })
    }
  }

  // Our side: players in the system, plus guests a manager adds on the way
  const ourTmIds = new Set(blocks.flatMap((b) => b.rounds.flatMap((r) => r.results.filter((x) => x.isOurTeam).map((x) => x.tmId.toLowerCase()))))
  const known = (await db.player.findMany({ where: { isOpponentOnly: false } })).filter((p) => ourTmIds.has(p.tmId.toLowerCase()))
  const unknown = [...ourTmIds].filter((tmId) => !known.some((p) => p.tmId.toLowerCase() === tmId))
  const newGuests = unknown.map((tmId) => guests.find((g) => g.tmId.toLowerCase() === tmId))
  if (newGuests.some((g) => !g || !confirmedTmId(g.tmId))) {
    return NextResponse.json({ error: "A driver on our side is not in the system" }, { status: 400 })
  }
  if (newGuests.length > 0 && !canManage(user.role)) {
    return NextResponse.json({ error: "Only admins and managers can add new guests" }, { status: 403 })
  }

  await db.$transaction(
    (tx) => saveMatchImport(tx, match, blocks, known, newGuests.map((g) => g!)),
    { timeout: 60000 }
  )

  if (newGuests.length > 0) await syncPlayerSlugs()
  return NextResponse.json({ imported: blocks.reduce((sum, b) => sum + b.rounds.length, 0) })
}
