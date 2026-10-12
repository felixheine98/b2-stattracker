"use client"

import { PlayerName } from "@/components/player-name"
import { GuestBadge } from "@/components/guest-badge"
import { TrialBadge } from "@/components/trial-badge"
import { Badge } from "@/components/ui/badge"
import { cn, formatLabel } from "@/lib/utils"
import { formatPacePct, pacePct } from "@/lib/pace"
import Link from "next/link"
import { useState } from "react"
import type { FormatAggregate } from "@/lib/format-stats"

interface Props {
  agg: FormatAggregate
  isGuest: (tmId: string) => boolean
  isTrial: (tmId: string) => boolean
  // Name of the player's lineup; adds the "Lineup" column when given
  lineupName?: (tmId: string) => string | undefined
  // Address of the player's profile; names without one are plain text
  profilePath?: (tmId: string) => string | undefined
}

type SortCol = "name" | "lineup" | "played" | "placementSum" | "avg" | "pace" | "dnfs" | "roundsWon" | "roundsLost"

export function FormatStatsTable({ agg, isGuest, isTrial, lineupName, profilePath }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const avg = (p: { roundsPlayed: number; placementSum: number }) => (p.roundsPlayed > 0 ? p.placementSum / p.roundsPlayed : Infinity)
  const players = Array.from(agg.players.values()).sort((a, b) => {
    let cmp = 0
    if (sortCol === "lineup") cmp = (lineupName?.(a.tmId) ?? "").localeCompare(lineupName?.(b.tmId) ?? "")
    else if (sortCol === "played") cmp = a.roundsPlayed - b.roundsPlayed
    else if (sortCol === "placementSum") cmp = a.placementSum - b.placementSum
    else if (sortCol === "avg") cmp = avg(a) - avg(b)
    // Players without a timed round come last
    else if (sortCol === "pace") cmp = (pacePct(a.pace) ?? Infinity) - (pacePct(b.pace) ?? Infinity)
    else if (sortCol === "dnfs") cmp = a.dnfs - b.dnfs
    else if (sortCol === "roundsWon") cmp = a.roundsWon - b.roundsWon
    else if (sortCol === "roundsLost") cmp = a.roundsLost - b.roundsLost
    // Equal values keep the players in alphabetical order
    return (sortDir === "asc" ? cmp : -cmp) || a.name.localeCompare(b.name)
  })

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortCol(col); setSortDir("asc") }
  }

  function th(col: SortCol, label: string, className: string) {
    const active = sortCol === col
    return (
      <th onClick={() => toggleSort(col)} className={cn("py-2 font-medium whitespace-nowrap cursor-pointer select-none group", className)}>
        <span className="inline-flex items-center gap-1">
          <span className={cn("transition-colors", active ? "text-fg" : "text-fg-subtle group-hover:text-fg-muted")}>{label}</span>
          <span className={cn("text-[9px] transition-colors", active ? "text-brand-ink" : "text-line group-hover:text-line-strong")}>
            {active && sortDir === "desc" ? "▼" : "▲"}
          </span>
        </span>
      </th>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={agg.format === "TIME_ATTACK_10" ? "primary" : "secondary"}>
          {formatLabel(agg.format)}
        </Badge>
        <span className="text-xs text-fg-subtle">
          Map: {agg.mapWon}W{agg.mapDrawn > 0 ? ` – ${agg.mapDrawn}D` : ""} – {agg.mapLost}L
          &nbsp;·&nbsp;Rounds: {agg.teamRoundsWon}W – {agg.teamRoundsLost}L
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs bg-table-row">
          <thead>
            <tr className="border-b border-line bg-table-head">
              {th("name", "Player", "sticky left-0 z-[1] bg-table-head text-left pl-3 pr-4")}
              {lineupName && th("lineup", "Lineup", "text-left px-3")}
              {th("played", "Played", "text-right px-3")}
              {th("placementSum", "Place sum", "text-right px-3")}
              {th("avg", "Avg place", "text-right px-3")}
              {th("pace", "Pace", "text-right px-3")}
              {th("dnfs", "DNF", "text-right px-3")}
              {th("roundsWon", "Round W", "text-right px-3")}
              {th("roundsLost", "Round L", "text-right pr-3")}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.tmId} className="border-b border-table-rule hover:bg-table-hover">
                <td className="sticky left-0 z-[1] bg-table-cell py-1.5 pl-3 pr-4 text-fg font-medium whitespace-nowrap max-md:shadow-[1px_0_0_var(--border)]">
                  {profilePath?.(p.tmId) ? (
                    <Link href={profilePath(p.tmId)!} className="hover:text-brand-ink">
                      <PlayerName name={p.name} currentName={p.currentName} />
                    </Link>
                  ) : (
                    <PlayerName name={p.name} currentName={p.currentName} />
                  )}
                  {isGuest(p.tmId) && <GuestBadge className="ml-1.5" />}
{isTrial(p.tmId) && <TrialBadge className="ml-1.5" />}
                </td>
                {lineupName && <td className="py-1.5 px-3 text-fg-soft whitespace-nowrap">{lineupName(p.tmId) ?? "—"}</td>}
                <td className="py-1.5 px-3 text-right text-fg-soft">{p.roundsPlayed}</td>
                <td className="py-1.5 px-3 text-right text-fg-soft">{p.placementSum}</td>
                <td className="py-1.5 px-3 text-right text-fg-soft font-mono">
                  {p.roundsPlayed > 0 ? (p.placementSum / p.roundsPlayed).toFixed(3) : "—"}
                </td>
                <td className="py-1.5 px-3 text-right text-fg-soft font-mono" title="Average gap to the fastest time of the round, without DNFs">
                  {formatPacePct(pacePct(p.pace))}
                </td>
                <td className="py-1.5 px-3 text-right text-fg-soft">{p.dnfs}</td>
                <td className="py-1.5 px-3 text-right text-fg">{p.roundsWon}</td>
                <td className="py-1.5 pr-3 text-right text-fg">{p.roundsLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
