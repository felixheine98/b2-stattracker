"use client"

import { useState } from "react"
import Link from "next/link"
import type { getTfhRace } from "@/lib/tfh-db"
import { lineupPath, playerPath } from "@/lib/paths"
import { formatTfhDuration } from "@/lib/tfh-profile"
import { rankTfhDrivers, type TfhMetric } from "@/lib/tfh-ranking"
import { formatTime } from "@/lib/utils"
import { SortHeader } from "./sort-header"

type Race = NonNullable<Awaited<ReturnType<typeof getTfhRace>>>

const first = "sticky left-0 z-[1] bg-table-cell px-3 py-2 text-left max-md:shadow-[1px_0_0_var(--border)]"
const cell = "whitespace-nowrap px-3 py-2 text-right"
const time = (ms: number | null) => (ms === null ? "—" : formatTime(ms))

const COLUMNS: Array<{ metric: TfhMetric; label: string }> = [
  { metric: "cpm", label: "CPM" },
  { metric: "checkpoints", label: "CP" },
  { metric: "playTimeSeconds", label: "Play time" },
  { metric: "bestLapMs", label: "Best lap" },
  { metric: "averageLapMs", label: "Average lap" },
  { metric: "finishes", label: "Finishes" },
]

// All B2 drivers of one race in one table, whatever team they drove for
export function TfhDriverRanking({ race }: { race: Race }) {
  const [metric, setMetric] = useState<TfhMetric>("cpm")
  const [order, setOrder] = useState<"best" | "worst">("best")
  const rows = rankTfhDrivers(race.teams, metric, order)
  if (!rows.length) return null

  function sortBy(next: TfhMetric) {
    if (next === metric) setOrder(o => (o === "best" ? "worst" : "best"))
    else { setMetric(next); setOrder("best") }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">B2 driver ranking</h2>
        <Link href="/tfh" className="text-sm text-brand-ink hover:underline">All editions →</Link>
      </div>
      <p className="text-xs text-fg-muted">All B2 drivers of this race compared, across the B2 teams. Click a column to rank by it; drivers without a value are listed last.</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full bg-table-row text-xs">
          <thead className="bg-table-head text-fg-muted">
            <tr>
              <th className={first}>Driver</th>
              <th className="whitespace-nowrap px-3 py-2 text-left">Team</th>
              {COLUMNS.map(c => <SortHeader key={c.metric} label={c.label} active={metric === c.metric} order={order} onClick={() => sortBy(c.metric)} className={cell} />)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ driver: d, team: t, rank }) => (
              <tr key={d.id} className="border-t border-table-rule">
                <td className={first}>
                  <span className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right font-mono text-fg-subtle">{rank ?? "–"}</span>
                    <Link href={playerPath(d.player)} title={`Current profile: ${d.player.name}`} className="block max-w-32 truncate text-brand-ink hover:underline sm:max-w-40">{d.sourceName}</Link>
                  </span>
                </td>
                <td className="px-3 py-2 text-left text-fg-muted">
                  <span className="block max-w-36 truncate" title={`${t.name} · #${t.rank}`}>
                    {t.lineup ? <Link href={lineupPath(race.tournament, t.lineup)} className="hover:underline">{t.name}</Link> : t.name}
                  </span>
                </td>
                <td className={cell}>{d.cpm?.toFixed(3) ?? "—"}</td>
                <td className={cell}>{d.checkpoints ?? "—"}</td>
                <td className={cell}>{formatTfhDuration(d.playTimeSeconds)}</td>
                <td className={`${cell} font-mono`}>{time(d.bestLapMs)}</td>
                <td className={`${cell} font-mono`}>{time(d.averageLapMs)}</td>
                <td className={cell}>{d.finishes.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
