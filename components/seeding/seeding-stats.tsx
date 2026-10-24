"use client"

import Link from "next/link"
import { Flag, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOwnRow } from "@/components/own-player"
import { PlayerName } from "@/components/player-name"
import type { LoadedSeedingStats } from "@/lib/seeding-stats-db"

interface Props {
  stats: LoadedSeedingStats
  // On a lineup's page the lineup table is one row: shown as its result instead
  single?: boolean
}

const head = "py-2 px-2.5 font-medium whitespace-nowrap"
const cell = "py-1.5 px-2.5 text-right tabular-nums text-fg-soft"

// The seeding of a comp in a seeding format (docs/adr/010): team totals with place and league, and
// per player their score on each map, the counted ones marked; kept apart from the other stats, as scores measure something else
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
        <div className="w-fit max-w-full overflow-x-auto rounded-lg border border-line">
          <table className="bg-table-row text-xs">
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
        <div className="w-fit max-w-full overflow-x-auto rounded-lg border border-line">
          <table className="bg-table-row text-xs">
            <thead>
              <tr className="border-b border-line bg-table-head text-fg-muted">
                <th className={`${head} sticky left-0 z-[1] bg-table-head text-left`}>Player</th>
                {!single && <th className={`${head} text-left`}>Lineup</th>}
                {stats.maps.map((name) => <th key={name} className={`${head} text-right`}>{name}</th>)}
              </tr>
            </thead>
            <tbody>
              {stats.players.map((p) => (
                <tr key={`${p.lineupId}:${p.playerId}`} className={`border-b border-table-rule hover:bg-table-hover ${ownRow({ playerId: p.playerId, tmId: p.player.tmId })}`}>
                  <td className="sticky left-0 z-[1] whitespace-nowrap bg-table-cell py-1.5 px-3 font-medium text-fg max-md:shadow-[1px_0_0_var(--border)]">
                    <Link href={p.href} className="hover:text-brand-ink"><PlayerName name={p.player.name} nickname={p.player.nickname} /></Link>
                  </td>
                  {!single && <td className="whitespace-nowrap py-1.5 px-3 text-fg-soft">{p.lineupName}</td>}
                  {p.maps.map((m, i) => (
                    <td key={i} className={cn(cell, m?.counted && "font-semibold text-fg")}>
                      {m?.counted && <Trophy size={11} className="mr-1 inline text-brand-ink" aria-label={`among the best ${stats.best} of the map`} />}
                      {m ? (m.score ?? "—") : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="w-0 min-w-full border-t border-line px-2.5 py-1.5 text-[11px] text-fg-subtle">
            <Trophy size={10} className="mr-1 inline text-brand-ink" />
            among the best {stats.best} of the map, counted for the team total
          </p>
        </div>
      )}
    </div>
  )
}
