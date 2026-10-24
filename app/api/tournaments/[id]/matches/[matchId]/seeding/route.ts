import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { mayEditLineupById, type SessionUser } from "@/lib/lineup-access-db"
import { matchLineup, type PlanVariant } from "@/lib/matchday-plan"
import { assignScores, seedingSettings } from "@/lib/seeding"
import { parseSeedingSheet } from "@/lib/seeding-sheet"
import { fetchSeedingSheet, SheetError } from "@/lib/seeding-sheet-fetch"
import { shownName } from "@/lib/player-names"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

// The results of a seeding match in a seeding format (docs/adr/010): taken over from the master
// sheet after a preview, or recorded by hand run by run, with the official place and league
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), url: z.string().trim().max(500), team: z.string().max(200).optional() }),
  z.object({ action: z.literal("import"), url: z.string().trim().max(500), team: z.string().max(200) }),
  z.object({ action: z.literal("run"), subMatchId: z.string(), playerId: z.string().nullable(), score: z.number().int().min(0).max(100000).nullable() }),
  z.object({ action: z.literal("result"), place: z.number().int().min(1).max(1000).nullable(), league: z.string().trim().max(60).nullable() }),
])

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return bad("Unauthorized", 401)
  const { id, matchId } = await params
  const match = await db.match.findFirst({
    where: { id: matchId, tournamentId: id },
    include: {
      stage: true,
      tournament: { select: { seedingType: true, seedingSettings: true } },
      tournamentLineup: { select: { name: true } },
      subMatches: { orderBy: { order: "asc" }, include: { seedingRun: true } },
    },
  })
  if (!match) return bad("Match not found", 404)
  if (!(await mayEditLineupById(session.user as SessionUser, match.tournamentLineupId))) return bad("Forbidden", 403)
  const settings = match.stage.type === "SEEDING" ? seedingSettings(match.tournament.seedingType, match.tournament.seedingSettings) : null
  if (!settings) return bad("This is not a seeding match in a seeding format")

  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return bad(parsed.error.issues[0].message)
  const body = parsed.data
  const runs = match.subMatches.filter((sm) => sm.seedingRun)

  if (body.action === "run") {
    const run = runs.find((sm) => sm.id === body.subMatchId)
    if (!run) return bad("Run not found", 404)
    if (body.playerId && !(await db.player.findUnique({ where: { id: body.playerId }, select: { id: true } }))) return bad("Unknown player")
    await db.seedingRun.update({ where: { subMatchId: run.id }, data: { playerId: body.playerId, score: body.score } })
    return NextResponse.json({ ok: true })
  }
  if (body.action === "result") {
    await db.match.update({ where: { id: match.id }, data: { seedingPlace: body.place, seedingLeague: body.league || null } })
    return NextResponse.json({ ok: true })
  }

  let sheet
  try {
    const fetched = await fetchSeedingSheet(body.url)
    sheet = parseSeedingSheet(fetched.seeding, fetched.leagues ?? undefined)
  } catch (e) {
    if (e instanceof SheetError) return bad(e.message)
    throw e
  }
  if (sheet.teams.length === 0) return bad("No teams found in the tab “Seeding”.")
  const teams = sheet.teams.map((t) => t.name)
  const lineupName = match.tournamentLineup?.name.toLowerCase()
  const name = body.team ?? teams.find((t) => t.toLowerCase() === lineupName)
  const team = sheet.teams.find((t) => t.name === name)
  if (!team) {
    if (body.action === "import") return bad("The team is not in the sheet")
    return NextResponse.json({ teams, team: null, maps: sheet.maps })
  }

  // The drivers of each map that the app knows, by their Trackmania account
  const drivers = team.maps.flatMap((players) => players.filter((p) => p.points > 0))
  const known = await db.player.findMany({ where: { tmId: { in: drivers.map((d) => d.tmId), mode: "insensitive" } }, select: { id: true, tmId: true, name: true, nickname: true } })
  const playerOf = (tmId: string) => known.find((p) => p.tmId?.toLowerCase() === tmId)?.id
  const unknown = drivers.filter((d) => !playerOf(d.tmId)).map((d) => ({ name: d.name, tmId: d.tmId }))

  // Who was planned for each run, as finalised in the matchday planning
  const plan = match.tournamentLineupId
    ? await db.matchdayPlan.findUnique({ where: { lineupId_stageId: { lineupId: match.tournamentLineupId, stageId: match.stageId } }, select: { published: true } })
    : null
  const planned = plan?.published ? matchLineup(plan.published as unknown as PlanVariant, { id: match.id, formats: ["SEEDING_RUN"] }).SEEDING_RUN ?? [] : []
  const assigned = assignScores(
    settings,
    runs.map((sm, i) => ({ planned: planned[i] ?? null, recorded: sm.seedingRun!.playerId })),
    team.maps.map((players) => players.flatMap((p) => (p.points > 0 && playerOf(p.tmId) ? [{ playerId: playerOf(p.tmId)!, score: p.points }] : []))),
  )

  if (body.action === "preview") {
    return NextResponse.json({ teams, team: team.name, maps: sheet.maps, rank: team.rank, league: team.league, total: team.total, runs: assigned.runs, names: Object.fromEntries(known.map((p) => [p.id, shownName(p)])), unknown, unplaced: assigned.unplaced })
  }

  await db.$transaction([
    ...runs.map((sm, i) => db.seedingRun.update({ where: { subMatchId: sm.id }, data: { playerId: assigned.runs[i]?.playerId ?? null, score: assigned.runs[i]?.score ?? null } })),
    db.match.update({ where: { id: match.id }, data: { seedingPlace: team.rank, seedingLeague: team.league } }),
    db.stage.update({ where: { id: match.stageId }, data: { seedingMaps: sheet.maps } }),
    db.tournament.update({ where: { id }, data: { seedingSheet: body.url } }),
  ])
  return NextResponse.json({ ok: true, unknown, unplaced: assigned.unplaced })
}
