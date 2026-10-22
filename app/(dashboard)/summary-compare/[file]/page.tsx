// One transcribed comp: every screenshot next to what was read from it and what is stored
// (docs/adr/007). Dev only; the screenshots come from the local Discord export.
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react"
import { auth } from "@/lib/auth"
import { BASE_PATH } from "@/lib/base-path"
import { summaryCompareEnabled } from "@/lib/features"
import { matchPath } from "@/lib/paths"
import { canManage } from "@/lib/roles"
import { summaryComparison } from "@/lib/summary-compare-db"
import type { ComparedSubMatch } from "@/lib/summary-compare"
import { matchLabel } from "@/lib/summary-import"
import { cn, formatLabel } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Props {
  params: Promise<{ file: string }>
}

const KIND = { summary: "imported", rounds: "round results · check only", none: "not imported" }

function Notes({ title, lines, tone }: { title: string; lines: string[]; tone: "danger" | "muted" }) {
  if (lines.length === 0) return null
  return (
    <div className={cn("rounded-xl border px-4 py-3", tone === "danger" ? "border-danger/40 bg-danger/5" : "border-line bg-surface")}>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fg">
        <TriangleAlert size={14} className={tone === "danger" ? "text-danger" : "text-fg-subtle"} />
        {title}
      </p>
      <ul className="space-y-0.5 text-xs text-fg-soft">
        {lines.map((line) => <li key={line} className="break-words">{line}</li>)}
      </ul>
    </div>
  )
}

// Rounds / place sum, or rounds / points where the screenshot gives points instead of places
const values = (v: { rounds: number; placementSum: number | null; points: number | null } | null) =>
  !v ? "—" : v.placementSum !== null ? `${v.rounds} / ${v.placementSum}` : `${v.rounds} / ${v.points ?? "—"} pts`
const result = (r: { won: number | null; lost: number | null; outcome: string | null } | null) =>
  !r ? "—" : r.won !== null && r.lost !== null ? `${r.won}:${r.lost} ${r.outcome ?? ""}` : (r.outcome ?? "—")

function SubMatchTable({ sm }: { sm: ComparedSubMatch }) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{formatLabel(sm.format)}</Badge>
        {sm.track && <span className="text-fg">{sm.track}</span>}
        <span className={cn("text-xs", sm.resultDiffers ? "font-semibold text-danger" : "text-fg-muted")}>
          screenshot {result(sm.file)} · stored {result(sm.stored)}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[360px] text-xs bg-table-row">
          <thead>
            <tr className="border-b border-line text-fg-subtle">
              <th className="sticky left-0 bg-table-cell py-1.5 pl-3 pr-4 text-left font-medium">Player</th>
              <th className="py-1.5 px-2 text-right font-medium">Screenshot</th>
              <th className="py-1.5 px-2 text-right font-medium">Stored</th>
            </tr>
          </thead>
          <tbody>
            {sm.players.map((p) => (
              <tr key={p.tmId} className={cn("border-b border-table-rule", p.differs && "bg-danger/10")}>
                <td className="sticky left-0 bg-table-cell py-1.5 pl-3 pr-4 text-fg whitespace-nowrap">{p.name}</td>
                <td className="py-1.5 px-2 text-right font-mono text-fg-soft">{values(p.file)}</td>
                <td className={cn("py-1.5 px-2 text-right font-mono", p.differs ? "font-semibold text-danger" : "text-fg-soft")}>{values(p.stored)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Screenshot({ image }: { image: string }) {
  const src = `${BASE_PATH}/api/summary-screenshots/${image}`
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- served from the local export, not optimisable */}
      <img src={src} alt={`Screenshot ${image}`} className="max-w-full rounded-lg border border-line" loading="lazy" />
    </a>
  )
}

export default async function SummaryCompareFilePage({ params }: Props) {
  const session = await auth()
  if (!summaryCompareEnabled() || !canManage((session?.user as { role?: string } | undefined)?.role)) redirect("/tournaments")
  const { file } = await params
  const data = await summaryComparison(file)
  if (!data) notFound()
  const { plan, matches, warnings, totals, tournamentFound } = data

  // In the order of the file: every screenshot with the matches read from it
  const images = [...new Set(matches.flatMap((m) => m.planned.subMatches.map((sm) => sm.sourceImage)))]
  const totalImages = [...new Set(plan.totals.map((t) => t.sourceImage))]

  return (
    <div className="space-y-6 page-wide">
      <div>
        <Link href="/summary-compare" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft size={14} />
          All comps
        </Link>
        <h1 className="mt-2   text-fg page-title">{plan.comp || file}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Per player: rounds / place sum (or points, marked &ldquo;pts&rdquo;). Red: screenshot and stored values differ.
          {!tournamentFound && " The comp is not in the database yet."}
        </p>
      </div>

      <Notes title="Errors in the file" lines={plan.errors} tone="danger" />
      <Notes title="Differences to the total tables" lines={totals} tone="danger" />
      <Notes title="Possible reading mistakes" lines={warnings} tone="muted" />

      {images.map((image) => (
        <section key={image} className="page-columns-even rounded-xl border border-line bg-surface p-4">
          <div className="page-main">
            <Screenshot image={image} />
          </div>
          <div className="space-y-5">
            {matches.filter((m) => m.planned.subMatches.some((sm) => sm.sourceImage === image)).map((m) => {
              const kinds = [...new Set(m.subMatches.map((sm) => sm.kind ?? "none"))]
              return (
                <div key={matchLabel(m.planned)} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">{matchLabel(m.planned)}</span>
                    <span className="text-sm text-fg-muted">vs {m.planned.opponent}</span>
                    {m.planned.date && <span className="text-xs text-fg-subtle">{m.planned.date}</span>}
                    {kinds.map((k) => <Badge key={k} variant={k === "none" ? "red" : k === "rounds" ? "secondary" : "default"}>{KIND[k]}</Badge>)}
                    {m.path && (
                      <Link href={matchPath(m.path.tournament, m.path.lineup, m.path.match)} className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-brand-ink">
                        <ExternalLink size={11} />
                        Match page
                      </Link>
                    )}
                  </div>
                  {m.subMatches.filter((sm) => sm.sourceImage === image).map((sm) => <SubMatchTable key={sm.order} sm={sm} />)}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {totalImages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold  text-fg-muted">Total tables</h2>
          <p className="text-sm text-fg-muted">{totals.length === 0 ? "The matches add up to every total table." : `${totals.length} differences, listed at the top.`}</p>
          {totalImages.map((image) => (
            <section key={image} className="rounded-xl border border-line bg-surface p-4">
              <Screenshot image={image} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
