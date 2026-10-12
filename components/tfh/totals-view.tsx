"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { playerPath, tournamentPath } from "@/lib/paths"
import { formatTfhDuration } from "@/lib/tfh-profile"
import { rankTfhTotals, type TfhTotalMetric } from "@/lib/tfh-ranking"
import { SortHeader } from "./sort-header"

interface Props {
  results: Array<{ playerId: string; raceId: string; checkpoints: number | null; playTimeSeconds: number | null }>
  players: Array<{ id: string; slug: string | null; name: string }>
  races: Array<{ id: string; name: string; slug: string | null }>
}

const first = "sticky left-0 z-[1] bg-table-cell px-3 py-2 text-left max-md:shadow-[1px_0_0_var(--border)]"
const cell = "whitespace-nowrap px-3 py-2 text-right"

const COLUMNS: Array<{ metric: TfhTotalMetric; label: string }> = [
  { metric: "races", label: "Editions" },
  { metric: "playTimeSeconds", label: "Play time" },
  { metric: "checkpoints", label: "Checkpoints" },
]

// What the B2 drivers did over all archived TFH editions together
export function TfhTotalsView({ results, players, races }: Props) {
  const [metric, setMetric] = useState<TfhTotalMetric>("playTimeSeconds")
  const [order, setOrder] = useState<"best" | "worst">("best")
  const playerById = new Map(players.map(p => [p.id, p]))
  const rows = rankTfhTotals(results, metric, order)

  function sortBy(next: TfhTotalMetric) {
    if (next === metric) setOrder(o => (o === "best" ? "worst" : "best"))
    else { setMetric(next); setOrder("best") }
  }

  return (
    <div className="min-w-0 max-w-4xl space-y-6">
      <Link href="/tournaments" className="inline-flex items-center gap-2 text-sm text-fg-muted"><ArrowLeft size={14} />Tournaments</Link>
      <div>
        <h1 className="break-words text-2xl font-bold">TFH endurance: B2 drivers</h1>
        <p className="mt-1 text-sm text-fg-muted">{rows.length} drivers over {races.length} archived {races.length === 1 ? "edition" : "editions"}</p>
      </div>
      <p className="text-xs text-fg-muted">
        Only what adds up over different races is compared here: editions driven, play time and checkpoints. Pace (CPM) and lap times depend on the map and are ranked on the page of each race.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">No TFH race is archived yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full bg-table-row text-sm">
            <thead className="bg-table-head text-fg-muted">
              <tr>
                <th className={first}>Driver</th>
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
                        <span className="w-5 shrink-0 text-right font-mono text-xs text-fg-subtle">{row.rank}</span>
                        {player ? <Link href={playerPath(player)} className="block max-w-40 truncate text-brand-ink hover:underline sm:max-w-64">{player.name}</Link> : "—"}
                      </span>
                    </td>
                    <td className={cell}>{row.races}</td>
                    <td className={cell}>{formatTfhDuration(row.playTimeSeconds)}{row.incomplete && <span title="At least one value was not supplied by TFH"> *</span>}</td>
                    <td className={cell}>{row.checkpoints}{row.incomplete && <span title="At least one value was not supplied by TFH"> *</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.some(r => r.incomplete) && <p className="text-xs text-fg-muted">* TFH supplied no play time or checkpoints for at least one race of this driver; the total only holds what is known.</p>}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Editions</h2>
        <div className="flex flex-wrap gap-2">
          {races.map(r => <Link key={r.id} href={tournamentPath(r)} className="rounded-full border border-line-strong px-3 py-1 text-sm text-fg-soft hover:border-fg-subtle hover:text-fg">{r.name}</Link>)}
        </div>
      </section>
    </div>
  )
}
