// Writes a comp's transcribed stats screenshots into the database (docs/adr/007). The file is
// the whole truth for the comp's summary matches: they are replaced on every import. Matches
// that have round results take precedence and stay untouched; they are only reported, to be
// compared with their screenshot on the comparison page.
import type { CompStyle, PrismaClient } from "@prisma/client"
import { OpponentError, resolveMatchOpponent } from "./opponents-db"
import { FORMATS, matchLabel, type SummaryPlan } from "./summary-import"

const STYLES: CompStyle[] = ["TECH", "FULLSPEED", "DIRT", "ICE", "RPG", "ENDURANCE", "MIXED"]

export interface SummaryImportReport {
  tournamentId: string
  created: number
  // Matches that already have round results
  kept: string[]
}

const sameName = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase()

// The comp to create when the file is marked "# create: yes"
function compToCreate(plan: SummaryPlan) {
  const { start, end, formats, style } = plan.meta
  const list = (formats ?? "").split(",").map((f) => FORMATS[f.trim().toLowerCase()])
  if (!start || !end || list.length === 0 || list.some((f) => !f)) throw new Error(`Comp "${plan.comp}": start, end and formats (e.g. 1v1,2v2) are needed to create it`)
  const upper = (style ?? "").toUpperCase() as CompStyle
  if (!STYLES.includes(upper)) throw new Error(`Comp "${plan.comp}": style must be one of ${STYLES.join(", ")}`)
  return { name: plan.comp, startDate: new Date(start), endDate: new Date(end), formats: list, style: upper }
}

export async function importSummary(plan: SummaryPlan, client: PrismaClient): Promise<SummaryImportReport> {
  if (plan.errors.length > 0) throw new Error(`The file has errors:\n${plan.errors.join("\n")}`)

  const tmIds = [...new Set(plan.matches.flatMap((m) => m.subMatches.flatMap((sm) => sm.players.map((p) => p.tmId))))]
  const players = await client.player.findMany({ where: { tmId: { in: tmIds } }, select: { id: true, tmId: true } })
  const playerOf = new Map(players.map((p) => [p.tmId, p.id]))
  const missing = tmIds.find((tmId) => !playerOf.has(tmId))
  if (missing) throw new Error(`No player with tmId ${missing}`)

  return client.$transaction(async (tx) => {
    let tournament = await tx.tournament.findFirst({ where: { name: plan.comp } })
    if (!tournament) {
      if (plan.meta.create !== "yes") throw new Error(`Comp "${plan.comp}" not found`)
      tournament = await tx.tournament.create({ data: compToCreate(plan) })
    }
    const tournamentId = tournament.id

    // The summary matches of an earlier import: every sub-match a summary
    const previous = await tx.match.findMany({ where: { tournamentId, subMatches: { some: {}, every: { summary: { isNot: null } } } }, select: { id: true } })
    await tx.match.deleteMany({ where: { id: { in: previous.map((m) => m.id) } } })

    // What is left are matches with round results (or none yet); those of this import do not count
    const existing = await tx.match.findMany({ where: { tournamentId }, select: { tournamentLineupId: true, stageId: true, number: true, opponent: true } })

    const report: SummaryImportReport = { tournamentId, created: 0, kept: [] }
    for (const planned of plan.matches) {
      let lineup = await tx.tournamentLineup.findFirst({ where: { tournamentId, name: { equals: planned.team, mode: "insensitive" } } })
      if (!lineup) {
        // A lineup the screenshots add: its roster is everyone who drove for it
        const roster = [...new Set(plan.matches.filter((m) => m.team === planned.team).flatMap((m) => m.subMatches.flatMap((sm) => sm.players.map((p) => playerOf.get(p.tmId)!))))]
        lineup = await tx.tournamentLineup.create({ data: { tournamentId, name: planned.team, slots: { create: roster.map((playerId) => ({ playerId })) } } })
      }
      const stage =
        (await tx.stage.findUnique({ where: { tournamentId_type_number: { tournamentId, ...planned.stage } } })) ??
        (await tx.stage.create({ data: { tournamentId, ...planned.stage } }))

      const same = existing.filter((m) => m.tournamentLineupId === lineup.id && m.stageId === stage.id)
      if (same.some((m) => m.number === planned.number || sameName(m.opponent, planned.opponent))) {
        report.kept.push(matchLabel(planned))
        continue
      }

      let opponent: { id: string; name: string } | null = null
      try {
        opponent = await resolveMatchOpponent(tx, tournamentId, { name: planned.opponent })
      } catch (error) {
        if (!(error instanceof OpponentError)) throw error
      }
      await tx.match.create({
        data: {
          tournamentId,
          tournamentLineupId: lineup.id,
          stageId: stage.id,
          opponent: opponent?.name ?? planned.opponent,
          opponentLineupId: opponent?.id ?? null,
          number: planned.number,
          date: planned.date ? new Date(planned.date) : null,
          subMatches: {
            create: planned.subMatches.map((sm) => ({
              format: sm.format,
              order: sm.order - 1,
              lineup: { create: { slots: { create: sm.players.map((p) => ({ playerId: playerOf.get(p.tmId)! })) } } },
              summary: {
                create: {
                  track: sm.track,
                  rounds: sm.rounds,
                  roundsWon: sm.roundsWon,
                  roundsLost: sm.roundsLost,
                  outcome: sm.outcome,
                  sourceUrl: sm.sourceUrl,
                  sourceImage: sm.sourceImage,
                  players: { create: sm.players.map((p) => ({ playerId: playerOf.get(p.tmId)!, rounds: p.rounds, placementSum: p.placementSum, points: p.points })) },
                },
              },
            })),
          },
        },
      })
      report.created++
    }
    return report
  }, { timeout: 60000 })
}
