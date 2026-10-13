"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { playerPath, tournamentPath } from "@/lib/paths"
import { formatTfhDuration } from "@/lib/tfh-profile"
import { rankTfhTotals, splitTfhByKind, type TfhTotalMetric } from "@/lib/tfh-ranking"
import { SortHeader } from "./sort-header"

interface Result { playerId: string; raceId: string; kind: string; checkpoints: number | null; playTimeSeconds: number | null; finishes: number; cpm: number | null }
interface Player { id: string; slug: string | null; name: string }
// Newest first, as the page loads them
interface Race { id: string; name: string; kind: string; tournament: { id: string; slug: string | null } }

interface Props {
  results: Result[]
  players: Player[]
  races: Race[]
}

const first = "sticky left-0 z-[1] bg-table-cell px-3 py-2 text-left max-md:shadow-[1px_0_0_var(--border)]"
const cell = "whitespace-nowrap px-3 py-2 text-right"
const kindLabel = (kind: string) => (kind === "24h" ? "24h endurance" : kind === "12h" ? "12h RPG" : kind)

const COLUMNS: Array<{ metric: TfhTotalMetric; label: string }> = [
  { metric: "races", label: "Editions" },
  { metric: "playTimeSeconds", label: "Play time" },
  { metric: "checkpoints", label: "Checkpoints" },
  { metric: "finishes", label: "Finishes" },
]

// The drivers of the given results: the CPM of every edition in its own column with the rank among the
// B2 drivers of that edition, then what adds up over the editions. Ranked by the newest edition at first.
function Totals({ results, players, races }: Props) {
  const [metric, setMetric] = useState<TfhTotalMetric>(races[0] ? `cpm:${races[0].id}` : "playTimeSeconds")
  const [order, setOrder] = useState<"best" | "worst">("best")
  const playerById = new Map(players.map(p => [p.id, p]))
  const rows = rankTfhTotals(results, metric, order)
  const editions = [...races].reverse()

  function sortBy(next: TfhTotalMetric) {
    if (next === metric) setOrder(o => (o === "best" ? "worst" : "best"))
    else { setMetric(next); setOrder("best") }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {races.map(r => <Link key={r.id} href={tournamentPath(r.tournament)} className="rounded-full border border-line-strong px-3 py-1 text-xs text-fg-soft hover:border-fg-subtle hover:text-fg">{r.name}</Link>)}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full bg-table-row text-sm">
          <thead className="bg-table-head text-fg-muted">
            <tr>
              <th className={first}>Driver</th>
              {editions.map(r => <SortHeader key={r.id} label={`CPM ${r.name.replace(/^TFH\s+/, "")}`} active={metric === `cpm:${r.id}`} order={order} onClick={() => sortBy(`cpm:${r.id}`)} className={cell} />)}
              {COLUMNS.map(c => <SortHeader key={c.metric} label={c.label} active={metric === c.metric} order={order} onClick={() => sortBy(c.metric)} className={cell} />)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const player = playerById.get(row.playerId)
              return (
                <tr key={row.playerId} className="border-t border-table-rule">
                  <td className={first}>
                    <span className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right font-mono text-xs text-fg-subtle">{row.rank ?? "–"}</span>
                      {player ? <Link href={playerPath(player)} className="block max-w-40 truncate text-brand-ink hover:underline sm:max-w-64">{player.name}</Link> : "—"}
                    </span>
                  </td>
                  {editions.map(r => {
                    const edition = row.editions[r.id]
                    return (
                      <td key={r.id} className={cell}>
                        {!edition ? null : edition.cpm === null ? "—" : (
                          <>
                            {edition.cpm.toFixed(3)}
                            <span className={edition.rank === 1 ? "ml-1.5 inline-block w-7 text-left text-xs text-brand-ink" : "ml-1.5 inline-block w-7 text-left text-xs text-fg-subtle"}>#{edition.rank}</span>
                          </>
                        )}
                      </td>
                    )
                  })}
                  <td className={cell}>{row.races}</td>
                  <td className={cell}>{formatTfhDuration(row.playTimeSeconds)}{row.incomplete && <span title="At least one value was not supplied by TFH"> *</span>}</td>
                  <td className={cell}>{row.checkpoints}{row.incomplete && <span title="At least one value was not supplied by TFH"> *</span>}</td>
                  <td className={cell}>{row.finishes}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.some(r => r.incomplete) && <p className="text-xs text-fg-muted">* TFH supplied no play time or checkpoints for at least one race of this driver; the totals only hold what is known.</p>}
    </div>
  )
}

// What the B2 drivers did over all archived TFH editions together
export function TfhTotalsView({ results, players, races }: Props) {
  // 24h and 12h RPG races are different styles of driving, so they are apart unless asked otherwise
  const [split, setSplit] = useState(true)
  const groups = splitTfhByKind(results)
  const drivers = new Set(results.map(r => r.playerId)).size

  return (
    <div className="min-w-0 page-wide space-y-6">
      <Link href="/tournaments?style=endurance" className="inline-flex items-center gap-2 text-sm text-fg-muted"><ArrowLeft size={14} />Endurance tournaments</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold">TFH endurance: B2 drivers</h1>
          <p className="mt-1 text-sm text-fg-muted">{drivers} drivers over {races.length} archived {races.length === 1 ? "edition" : "editions"}</p>
        </div>
        {groups.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} />
            24h and 12h apart
          </label>
        )}
      </div>
      <p className="text-xs text-fg-muted">
        Every edition has its own CPM column with the rank among the B2 drivers of that edition (#1 is the fastest), because the maps differ from edition to edition. An empty cell means the driver did not take part. Click a column to rank by it.
      </p>
      {results.length === 0 ? (
        <p className="text-sm text-fg-muted">No TFH race is archived yet.</p>
      ) : split ? (
        groups.map(g => (
          <section key={g.kind} className="space-y-3">
            <h2 className="text-lg font-semibold">{kindLabel(g.kind)}</h2>
            <Totals key={g.kind} results={g.results} players={players} races={races.filter(r => r.kind === g.kind)} />
          </section>
        ))
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">All editions</h2>
          <Totals key="all" results={results} players={players} races={races} />
        </section>
      )}
    </div>
  )
}
