"use client"

import { PlayerName } from "@/components/player-name"
import { GuestBadge } from "@/components/guest-badge"
import { TrialBadge } from "@/components/trial-badge"
import { Badge } from "@/components/ui/badge"
import { mapGapMs, teamAvgMs, type MapAggregate } from "@/lib/map-stats"
import { formatGapSeconds } from "@/lib/pace"
import { cn, formatLabel, formatTime } from "@/lib/utils"
import Link from "next/link"
import { useState } from "react"

interface Props {
  agg: MapAggregate
  isGuest: (tmId: string) => boolean
  isTrial: (tmId: string) => boolean
  // Name of the player's lineup; adds the "Lineup" column when given
  lineupName?: (tmId: string) => string | undefined
  // Address of the player's profile; names without one are plain text
  profilePath?: (tmId: string) => string | undefined
  // The placement only means something within one format, so the column shows while a single one is looked at
  showPlacement: boolean
}

type SortCol = "name" | "lineup" | "rounds" | "best" | "gap" | "avg" | "dnfs" | "roundsWon" | "roundsLost"

// Who drives how well on a map: a ranking, so the fastest by average gap come first
export function MapStatsTable({ agg, isGuest, isTrial, lineupName, profilePath, showPlacement }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("gap")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const avg = (p: { rounds: number; placementSum: number }) => (p.rounds > 0 ? p.placementSum / p.rounds : Infinity)
  const players = Array.from(agg.players.values()).sort((a, b) => {
    let cmp = 0
    if (sortCol === "lineup") cmp = (lineupName?.(a.tmId) ?? "").localeCompare(lineupName?.(b.tmId) ?? "")
    else if (sortCol === "rounds") cmp = a.rounds - b.rounds
    // Players without a time come last
    else if (sortCol === "best") cmp = (a.bestMs ?? Infinity) - (b.bestMs ?? Infinity)
    else if (sortCol === "gap") cmp = (mapGapMs(a) ?? Infinity) - (mapGapMs(b) ?? Infinity)
    else if (sortCol === "avg") cmp = avg(a) - avg(b)
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
          <span className={cn("transition-colors", active ? "text-[#f5f0f0]" : "text-[#5e5858] group-hover:text-[#9a9090]")}>{label}</span>
          <span className={cn("text-[9px] transition-colors", active ? "text-[#FBD00D]" : "text-[#2d2829] group-hover:text-[#3a3435]")}>
            {active && sortDir === "desc" ? "▼" : "▲"}
          </span>
        </span>
      </th>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-[#f5f0f0]">{agg.track ?? "No map"}</span>
        {agg.formats.map((format) => (
          <Badge key={format} variant="secondary">{formatLabel(format)}</Badge>
        ))}
        <span className="text-xs text-[#5e5858]">
          Map: {agg.mapWon}W{agg.mapDrawn > 0 ? ` – ${agg.mapDrawn}D` : ""} – {agg.mapLost}L
          &nbsp;·&nbsp;Rounds: {agg.teamRoundsWon}W – {agg.teamRoundsLost}L
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#2d2829]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2d2829] bg-[#1c1819]">
              {th("name", "Player", "sticky left-0 z-[1] bg-[#1c1819] text-left pl-3 pr-4")}
              {lineupName && th("lineup", "Lineup", "text-left px-3")}
              {th("rounds", "Rounds", "text-right px-3")}
              {th("best", "Best time", "text-right px-3")}
              {th("gap", "Avg gap", "text-right px-3")}
              {showPlacement && th("avg", "Avg place", "text-right px-3")}
              {th("dnfs", "DNF", "text-right px-3")}
              {th("roundsWon", "Round W", "text-right px-3")}
              {th("roundsLost", "Round L", "text-right pr-3")}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.tmId} className="border-b border-[#1c1819] hover:bg-[#1c1819]/60">
                <td className="sticky left-0 z-[1] bg-[#0e0b0b] py-1.5 pl-3 pr-4 text-[#f5f0f0] font-medium whitespace-nowrap max-md:shadow-[1px_0_0_#2d2829]">
                  {profilePath?.(p.tmId) ? (
                    <Link href={profilePath(p.tmId)!} className="hover:text-[#FBD00D]">
                      <PlayerName name={p.name} currentName={p.currentName} />
                    </Link>
                  ) : (
                    <PlayerName name={p.name} currentName={p.currentName} />
                  )}
                  {isGuest(p.tmId) && <GuestBadge className="ml-1.5" />}
                  {isTrial(p.tmId) && <TrialBadge className="ml-1.5" />}
                </td>
                {lineupName && <td className="py-1.5 px-3 text-[#c5bfbf] whitespace-nowrap">{lineupName(p.tmId) ?? "—"}</td>}
                <td className="py-1.5 px-3 text-right text-[#c5bfbf]">{p.rounds}</td>
                <td className="py-1.5 px-3 text-right text-[#FBD00D] font-mono">{p.bestMs === null ? "—" : formatTime(p.bestMs)}</td>
                <td className="py-1.5 px-3 text-right text-[#f5f0f0] font-mono" title="Average gap to the fastest time of the round, without DNFs">
                  {formatGapSeconds(mapGapMs(p))}
                </td>
                {showPlacement && (
                  <td className="py-1.5 px-3 text-right text-[#c5bfbf] font-mono">{p.rounds > 0 ? (p.placementSum / p.rounds).toFixed(3) : "—"}</td>
                )}
                <td className="py-1.5 px-3 text-right text-[#c5bfbf]">{p.dnfs}</td>
                <td className="py-1.5 px-3 text-right text-[#f5f0f0]">{p.roundsWon}</td>
                <td className="py-1.5 pr-3 text-right text-[#f5f0f0]">{p.roundsLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// How the team does on each map: one row per map, without single players
export function MapOverviewTable({ maps }: { maps: MapAggregate[] }) {
  const th = "px-3 py-2 text-right font-medium whitespace-nowrap text-[#9a9090]"
  const td = "px-3 py-1.5 text-right whitespace-nowrap text-[#c5bfbf]"
  return (
    <div className="overflow-x-auto rounded-lg border border-[#2d2829]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2d2829] bg-[#1c1819]">
            <th className="sticky left-0 z-[1] bg-[#1c1819] py-2 pl-3 pr-4 text-left font-medium text-[#9a9090]">Map</th>
            <th className={cn(th, "text-left")}>Formats</th>
            <th className={th} title="Sub-matches won, drawn and lost on this map">Maps W–D–L</th>
            <th className={th}>Rounds W–L</th>
            <th className={th} title="Share of rounds won among those decided">Round win rate</th>
            <th className={th} title="Fastest time of one of our drivers">Best time</th>
            <th className={th} title="Average of all times of our drivers, without DNFs">Avg time</th>
          </tr>
        </thead>
        <tbody>
          {maps.map((agg) => {
            const decided = agg.teamRoundsWon + agg.teamRoundsLost
            const avg = teamAvgMs(agg)
            return (
              <tr key={agg.track ?? ""} className="border-b border-[#1c1819] last:border-0">
                <td className="sticky left-0 z-[1] bg-[#0e0b0b] py-1.5 pl-3 pr-4 font-medium whitespace-nowrap text-[#f5f0f0] max-md:shadow-[1px_0_0_#2d2829]">{agg.track ?? "No map"}</td>
                <td className={cn(td, "text-left")}>{agg.formats.map((f) => formatLabel(f)).join(", ")}</td>
                <td className={cn(td, "font-mono text-[#f5f0f0]")}>{agg.mapWon}–{agg.mapDrawn}–{agg.mapLost}</td>
                <td className={cn(td, "font-mono")}>{agg.teamRoundsWon}–{agg.teamRoundsLost}</td>
                <td className={cn(td, "font-mono")}>{decided > 0 ? `${Math.round((agg.teamRoundsWon / decided) * 100)} %` : "—"}</td>
                <td className={cn(td, "font-mono text-[#FBD00D]")}>{agg.teamBestMs === null ? "—" : formatTime(agg.teamBestMs)}</td>
                <td className={cn(td, "font-mono")}>{avg === null ? "—" : formatTime(Math.round(avg))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Switches a stats section between the tables per format and per map
export function StatsViewToggle({ byMap, onChange }: { byMap: boolean; onChange: (byMap: boolean) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#2d2829] p-0.5" role="tablist" aria-label="Split of the stats">
      {([[false, "By format"], [true, "By map"]] as const).map(([value, label]) => (
        <button
          key={label}
          type="button"
          role="tab"
          aria-selected={byMap === value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            byMap === value ? "bg-[#FBD00D]/15 text-[#FBD00D]" : "text-[#9a9090] hover:text-[#f5f0f0]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
