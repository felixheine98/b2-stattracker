"use client"

import { styleLabel, styleParam } from "@/lib/comp-styles"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react"
import type { getTfhRace } from "@/lib/tfh-db"
import { lineupPath, playerPath, tournamentPath } from "@/lib/paths"
import { formatDay } from "@/lib/player-status"
import { formatTfhDuration, formatTfhElapsed } from "@/lib/tfh-profile"
import { formatTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { TfhDriverRanking } from "./driver-ranking"

type Race = NonNullable<Awaited<ReturnType<typeof getTfhRace>>>
type Driver = Race["teams"][number]["drivers"][number]
const first = "sticky left-0 z-[1] bg-table-cell px-3 py-2 text-left max-md:shadow-[1px_0_0_var(--border)]"
const cell = "whitespace-nowrap px-3 py-2 text-right"
const time = (ms: number | null) => ms === null ? "—" : formatTime(ms)

function Finishes({ drivers }: { drivers: Driver[] }) {
  const [accountId, setAccountId] = useState(drivers[0]?.accountId ?? "")
  const [limit, setLimit] = useState(50)
  const driver = drivers.find(d => d.accountId === accountId) ?? drivers[0]
  if (!driver) return null
  return <details className="rounded-lg border border-line p-3">
    <summary className="cursor-pointer text-sm font-medium">Individual finishes</summary>
    <div className="mt-4 space-y-3">
      <Select aria-label="Driver for individual finishes" value={driver.accountId} onChange={e => { setAccountId(e.target.value); setLimit(50) }} className="sm:max-w-xs">
        {drivers.map(d => <option key={d.id} value={d.accountId}>{d.sourceName} ({d.finishes.length})</option>)}
      </Select>
      <p className="text-xs text-fg-muted">Finish times and the ranking recorded by TFH.</p>
      <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full bg-table-row text-xs">
        <thead className="bg-table-head text-fg-muted"><tr><th className={first}>Finish</th><th className={cell}>Timestamp</th><th className={cell}>Time</th><th className={cell}>Rank at finish</th></tr></thead>
        <tbody>{driver.finishes.slice(0, limit).map(f => <tr key={f.id} className="border-t border-table-rule"><td className={first}>{f.number + 1}</td><td className={cell}>{new Date(f.timestamp).toLocaleString("en-GB")}</td><td className={`${cell} font-mono`}>{time(f.timeMs)}</td><td className={cell}>{f.sourceRank ?? "—"}</td></tr>)}</tbody>
      </table></div>
      {!driver.finishes.length && <p className="text-sm text-fg-muted">No finish entries supplied for this driver.</p>}
      {limit < driver.finishes.length && <Button size="sm" variant="outline" onClick={() => setLimit(n => n + 100)}>Show more finishes</Button>}
    </div>
  </details>
}

export function TfhRaceView({ race, isAdmin, initialLineupId }: { race: Race; isAdmin: boolean; initialLineupId?: string }) {
  const [search, setSearch] = useState("")
  const [b2Only, setB2Only] = useState(false)
  const ourTeams = race.teams.filter(t => t.isB2 && (!initialLineupId || t.lineupId === initialLineupId))
  return <div className="min-w-0 page-wide space-y-6">
    <Link href={initialLineupId ? tournamentPath(race.tournament) : "/tournaments"} className="inline-flex items-center gap-2 text-sm text-fg-muted"><ArrowLeft size={14} />{initialLineupId ? race.tournament.name : "Tournaments"}</Link>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-2xl font-bold">{race.tournament.name}</h1><Link href={`/tournaments?style=${styleParam(race.tournament.style)}`}><Badge variant="purple">{styleLabel(race.tournament.style)}</Badge></Link></div>
        <p className="mt-1 text-sm text-fg-muted">{race.tournament.startDate && formatDay(race.tournament.startDate)} · {race.teams.length} teams · {race.mapName ?? "Map not provided"}</p>
      </div>
      {isAdmin && <Link href={`/tfh-import?url=${encodeURIComponent(race.sourceUrl)}`}><Button variant="outline"><RefreshCw size={14} />Update from TFH</Button></Link>}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted"><a href={race.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-ink">TFH source<ExternalLink size={12} /></a><span>Imported {new Date(race.importedAt).toLocaleString("en-GB")}</span><span>Missing source values appear as —.</span></div>
    {!initialLineupId && <TfhDriverRanking race={race} />}
    <section className="space-y-3"><h2 className="text-lg font-semibold">B2 lineups</h2>
      {ourTeams.map(t => <Card key={t.id} id={`team-${t.sourceTeamId}`}>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="break-words">{t.lineup ? <Link href={lineupPath(race.tournament, t.lineup)} className="hover:text-brand-ink">{t.name}</Link> : t.name}</CardTitle><span className="text-sm text-brand-ink">#{t.rank} · {t.checkpoints ?? "—"} CP</span></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full bg-table-row text-xs">
            <thead className="bg-table-head text-fg-muted"><tr><th className={first}>Driver</th>{["CP", "Play time", "CPM", "Best lap", "Average lap", "Finishes"].map(h => <th key={h} className={cell}>{h}</th>)}</tr></thead>
            <tbody>{t.drivers.map(d => <tr key={d.id} className="border-t border-table-rule"><td className={first}><Link href={playerPath(d.player)} title={`Current profile: ${d.player.name}`} className="block max-w-40 truncate text-brand-ink hover:underline">{d.sourceName}</Link></td><td className={cell}>{d.checkpoints ?? "—"}</td><td className={cell}>{formatTfhDuration(d.playTimeSeconds)}</td><td className={cell}>{d.cpm?.toFixed(3) ?? "—"}</td><td className={`${cell} font-mono`}>{time(d.bestLapMs)}</td><td className={`${cell} font-mono`}>{time(d.averageLapMs)}</td><td className={cell}>{d.finishes.length}</td></tr>)}</tbody>
          </table></div>
          <Finishes drivers={t.drivers} />
        </CardContent>
      </Card>)}
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Overall ranking</h2><div className="flex w-full flex-wrap items-center gap-3 sm:w-auto"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b2Only} onChange={e => setB2Only(e.target.checked)} />B2 only</label><Input aria-label="Search ranking" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams…" className="w-full sm:w-60" /></div></div>
      <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full bg-table-row text-sm">
        <thead className="bg-table-head text-fg-muted"><tr><th className={first}>Team</th><th className={cell}>Rank</th><th className={cell}>Checkpoints</th><th className={cell}>Last CP time</th></tr></thead>
        <tbody>{race.teams.filter(t => (!b2Only || t.isB2) && `${t.name} ${t.tag}`.toLowerCase().includes(search.toLowerCase())).map(t => <tr key={t.id} className={`border-t border-table-rule ${t.isB2 ? "text-brand-ink" : "text-fg-soft"}`}><td className={first}><span className="block max-w-40 truncate sm:max-w-72" title={t.name}>{t.lineup ? <Link href={lineupPath(race.tournament, t.lineup)} className="hover:underline">{t.name}</Link> : t.name}</span></td><td className={cell}>{t.rank}</td><td className={cell}>{t.checkpoints ?? "—"}</td><td className={`${cell} font-mono`}>{formatTfhElapsed(t.lastCpMs)}</td></tr>)}</tbody>
      </table></div>
    </section>
  </div>
}
