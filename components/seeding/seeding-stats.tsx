"use client"

import Link from "next/link"
import { Flag } from "lucide-react"
import { useOwnRow } from "@/components/own-player"
import { PlayerName } from "@/components/player-name"
import type { LoadedSeedingStats } from "@/lib/seeding-stats-db"

interface Props {
  stats: LoadedSeedingStats
  // On a lineup's page the lineup table is one row: shown as its result instead
  single?: boolean
}

const head = "py-2 px-3 font-medium whitespace-nowrap"
const cell = "py-1.5 px-3 text-right tabular-nums text-fg-soft"

// The seeding of a comp in a seeding format (docs/adr/010): team totals with place and league, and
// per player their runs and scores; kept apart from the other stats, as scores measure something else
export function SeedingStats({ stats, single = false }: Props) {
  const ownRow = useOwnRow()
  const lineup = stats.lineups[0]
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        <Flag size={14} />
        Seeding
      </h2>
      {single && lineup ? (
        <Link href={lineup.matchHref} className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm hover:border-line-strong">
          <span><span className="block text-xs text-fg-muted">Team total</span><span className="font-semibold tabular-nums text-fg">{lineup.total ?? "—"}</span></span>
          <span><span className="block text-xs text-fg-muted">Place</span><span className="font-semibold tabular-nums text-fg">{lineup.place ?? "—"}</span></span>
          <span><span className="block text-xs text-fg-muted">League</span><span className="font-medium text-fg">{lineup.league ?? "—"}</span></span>
        </Link>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full bg-table-row text-xs">
            <thead>
              <tr className="border-b border-line bg-table-head text-fg-muted">
                <th className={`${head} sticky left-0 z-[1] bg-table-head text-left`}>Lineup</th>
                <th className={`${head} text-right`}>Team total</th>
                <th className={`${head} text-right`}>Place</th>
                <th className={`${head} text-left`}>League</th>
              </tr>
            </thead>
            <tbody>
              {stats.lineups.map((l) => (
                <tr key={l.lineupId} className="border-b border-table-rule hover:bg-table-hover">
                  <td className="sticky left-0 z-[1] whitespace-nowrap bg-table-cell py-1.5 px-3 font-medium text-fg max-md:shadow-[1px_0_0_var(--border)]">
                    <Link href={l.matchHref} className="hover:text-brand-ink">{l.name}</Link>
                  </td>
                  <td className={`${cell} font-semibold text-fg`}>{l.total ?? "—"}</td>
                  <td className={cell}>{l.place ?? "—"}</td>
                  <td className="whitespace-nowrap py-1.5 px-3 text-fg-soft">{l.league ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {stats.players.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full bg-table-row text-xs">
            <thead>
              <tr className="border-b border-line bg-table-head text-fg-muted">
                <th className={`${head} sticky left-0 z-[1] bg-table-head text-left`}>Player</th>
                <th className={`${head} text-right`}>Runs</th>
                <th className={`${head} text-right`}>Avg score</th>
                <th className={`${head} text-right`}>Best</th>
                <th className={`${head} text-right`} title={`Runs among the best ${stats.best} of their map`}>Counted</th>
              </tr>
            </thead>
            <tbody>
              {stats.players.map((p) => (
                <tr key={p.playerId} className={`border-b border-table-rule hover:bg-table-hover ${ownRow({ playerId: p.playerId, tmId: p.player.tmId })}`}>
                  <td className="sticky left-0 z-[1] whitespace-nowrap bg-table-cell py-1.5 px-3 font-medium text-fg max-md:shadow-[1px_0_0_var(--border)]">
                    <Link href={p.href} className="hover:text-brand-ink"><PlayerName name={p.player.name} nickname={p.player.nickname} /></Link>
                  </td>
                  <td className={cell}>{p.runs}</td>
                  <td className={cell}>{p.average == null ? "—" : Math.round(p.average)}</td>
                  <td className={cell}>{p.best ?? "—"}</td>
                  <td className={cell}>{p.counted} / {p.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
