// Loads what the comparison page (docs/adr/007) needs: the transcribed file of a comp, checked,
// and the matches stored for it.
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { db } from "./db"
import { shapeSummaries, summaryInclude } from "./summary"
import { compareMatch } from "./summary-compare"
import { checkTotals, parseNames, planSummaryImport, summaryWarnings } from "./summary-import"

const DIR = path.join(process.cwd(), "data", "summary")

// The transcribed comps: every file but the name list
export async function summaryFiles(): Promise<Array<{ file: string; comp: string; errors: number }>> {
  const names = parseNames(await readFile(path.join(DIR, "names.tsv"), "utf8"))
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".tsv") && f !== "names.tsv").sort()
  return Promise.all(files.map(async (file) => {
    const plan = planSummaryImport(await readFile(path.join(DIR, file), "utf8"), names)
    return { file: file.replace(/\.tsv$/, ""), comp: plan.comp, errors: plan.errors.length }
  }))
}

export async function summaryComparison(file: string) {
  if (!/^[\w-]+$/.test(file)) return null
  const names = parseNames(await readFile(path.join(DIR, "names.tsv"), "utf8"))
  const text = await readFile(path.join(DIR, `${file}.tsv`), "utf8").catch(() => null)
  if (text === null) return null
  const plan = planSummaryImport(text, names)

  const tournament = await db.tournament.findFirst({
    where: { name: plan.comp },
    select: {
      id: true, slug: true,
      tournamentLineups: { select: { id: true, slug: true, name: true } },
      matches: {
        select: {
          id: true, slug: true, number: true, opponent: true, tournamentLineupId: true,
          stage: { select: { type: true, number: true } },
          subMatches: {
            orderBy: { order: "asc" },
            select: {
              format: true, order: true,
              rounds: { orderBy: { number: "asc" }, select: { results: { orderBy: [{ position: "asc" }, { timeMs: "asc" }], select: { tmId: true, playerName: true, isOurTeam: true, dnf: true } } } },
              ...summaryInclude,
            },
          },
        },
      },
    },
  })
  const stored = tournament ? shapeSummaries(tournament.matches) : []
  const sameName = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase()

  const matches = plan.matches.map((planned) => {
    const lineup = tournament?.tournamentLineups.find((l) => sameName(l.name, planned.team))
    const candidates = stored.filter((m) => lineup && m.tournamentLineupId === lineup.id && m.stage.type === planned.stage.type && m.stage.number === planned.stage.number)
    const match = candidates.find((m) => m.number === planned.number) ?? candidates.find((m) => sameName(m.opponent, planned.opponent)) ?? null
    return {
      planned,
      path: match && lineup && tournament ? { tournament: { id: tournament.id, slug: tournament.slug }, lineup, match: { id: match.id, slug: match.slug } } : null,
      subMatches: compareMatch(planned, match),
    }
  })

  return { plan, tournamentFound: !!tournament, matches, warnings: summaryWarnings(plan), totals: checkTotals(plan) }
}
