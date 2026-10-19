// Imports a comp's transcribed stats screenshots into the database (docs/adr/007), dev first:
//   docker compose -f docker-compose.dev.yml exec app node --experimental-transform-types scripts/import-summary.mjs data/summary/<comp>.tsv [--dry-run]
// Names are resolved through data/summary/names.tsv. Prints the file's errors, possible reading
// mistakes and the differences to the comp's total tables; imports only a file without errors.
import { readFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"

// Lets Node load the TypeScript modules of lib/ as they are: imports without extension and "@/"
const root = pathToFileURL(path.resolve(import.meta.dirname, "..") + "/").href
registerHooks({
  resolve(specifier, context, next) {
    const spec = specifier.startsWith("@/") ? root + specifier.slice(2) : specifier
    try {
      return next(spec, context)
    } catch (error) {
      if (spec.startsWith(".") || spec.startsWith("file:")) return next(spec + ".ts", context)
      throw error
    }
  },
})

const { checkTotals, parseNames, planSummaryImport, summaryWarnings } = await import("../lib/summary-import.ts")
const { importSummary } = await import("../lib/summary-import-db.ts")
const { syncTournamentSlugs } = await import("../lib/slugs-db.ts")
const { db } = await import("../lib/db.ts")

const file = process.argv[2]
const dryRun = process.argv.includes("--dry-run")
if (!file) {
  console.error("Usage: node --experimental-transform-types scripts/import-summary.mjs data/summary/<comp>.tsv [--dry-run]")
  process.exit(1)
}

const names = parseNames(readFileSync(path.join(import.meta.dirname, "../data/summary/names.tsv"), "utf8"))
const plan = planSummaryImport(readFileSync(file, "utf8"), names)
const section = (title, lines) => lines.length > 0 && console.log(`\n${title}:\n${lines.map((l) => `  ${l}`).join("\n")}`)

const subMatches = plan.matches.reduce((n, m) => n + m.subMatches.length, 0)
console.log(`${plan.comp}: ${plan.matches.length} matches, ${subMatches} sub-matches`)
section("Errors", plan.errors)
section("Possible reading mistakes", summaryWarnings(plan))
section("Differences to the total tables", checkTotals(plan))

if (plan.errors.length > 0) process.exit(1)
if (dryRun) process.exit(0)

const report = await importSummary(plan, db)
await syncTournamentSlugs(report.tournamentId)
console.log(`\nImported: ${report.created} matches`)
section("Kept, they have round results (compare on the comparison page)", report.kept)
await db.$disconnect()
