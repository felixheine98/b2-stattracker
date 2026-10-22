"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download } from "lucide-react"
import { BASE_PATH } from "@/lib/base-path"
import type { TfhAssignment, TfhPreview } from "@/lib/tfh-db"
import { formatTfhDuration } from "@/lib/tfh-profile"
import { formatTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function TfhImportView({ players, initialUrl }: { players: Array<{ id: string; name: string; tmId: string }>; initialUrl: string }) {
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl)
  const [preview, setPreview] = useState<TfhPreview | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [assignments, setAssignments] = useState<Record<string, TfhAssignment>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const selectionChanged = !!preview && JSON.stringify([...selected].sort()) !== JSON.stringify([...preview.race.selectedTeamIds].sort())
  const unresolved = preview?.assignments.some(a => !assignments[a.accountId]?.playerId && !assignments[a.accountId]?.create) ?? true

  async function request(body: unknown) {
    const response = await fetch(`${BASE_PATH}/api/tfh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "The import failed. Please try again.")
    return data
  }

  async function loadPreview(reload: boolean) {
    setBusy(true); setError("")
    try {
      const data: TfhPreview = await request({ action: "preview", url, ...(reload && { selectedTeamIds: selected }) })
      setPreview(data); setSelected(data.race.selectedTeamIds)
      setAssignments(previous => Object.fromEntries(data.assignments.map(a => [a.accountId, reload && previous[a.accountId] ? previous[a.accountId] : { accountId: a.accountId, ...(a.playerId && { playerId: a.playerId }) }])))
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the preview.") }
    finally { setBusy(false) }
  }

  async function save() {
    if (!preview || selectionChanged) return
    setBusy(true); setError("")
    try {
      const data = await request({ action: "save", draftId: preview.draftId, assignments: preview.assignments.map(a => assignments[a.accountId]) })
      router.push(data.path); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the race."); setBusy(false) }
  }

  return <div className="page-narrow space-y-6">
    <Link href="/tournaments" className="inline-flex items-center gap-2 text-sm text-fg-muted"><ArrowLeft size={14} />Tournaments</Link>
    <div><h1 className="page-title">TFH import</h1><p className="mt-1 text-sm text-fg-muted">Archive a completed 24h race or 12h RPG edition. Review teams and drivers before saving.</p></div>
    <form onSubmit={e => { e.preventDefault(); void loadPreview(false) }} className="space-y-2">
      <Label htmlFor="tfh-url">TFH race URL</Label>
      <div className="flex flex-wrap gap-2">
        <Input id="tfh-url" type="url" value={url} onChange={e => { setUrl(e.target.value); setPreview(null) }} placeholder="https://trackmaniaforhours.com/event/24h/race/4/teams" className="min-w-0 flex-1 basis-64" required disabled={busy} />
        <Button disabled={busy || !url}><Download size={16} />{busy ? "Loading…" : "Load preview"}</Button>
      </div>
    </form>
    <details className="rounded-lg border border-line p-3 text-sm">
      <summary className="cursor-pointer text-fg-muted">Historical B2 editions</summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {["24h/race/0", "24h/race/1", "24h/race/2", "24h/race/3", "24h/race/4", "12h/rpg/1", "12h/rpg/2", "12h/rpg/3"].map(path => <Button key={path} variant="outline" size="sm" disabled={busy} onClick={() => { setUrl(`https://trackmaniaforhours.com/event/${path}/teams`); setPreview(null); setError("") }}>{path.replace("/race/", " #").replace("/rpg/", " RPG #")}</Button>)}
      </div>
    </details>
    {error && <p role="alert" className="rounded-lg border border-danger/30 p-3 text-sm text-danger">{error}</p>}
    {preview && <>
      <Card><CardHeader><CardTitle>{preview.race.name}</CardTitle><p className="text-sm text-fg-muted">{new Date(preview.race.startDate).toLocaleDateString("en-GB")} · {preview.race.teams.length} teams · {preview.race.mapName ?? "Map not provided"}</p></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Select our teams ({selected.length})</h2><Input aria-label="Search teams" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams…" className="w-full sm:w-64" /></div>
          <p className="text-sm text-fg-muted">All teams enter the overall ranking. Selected teams also get driver details and historical lineups.</p>
          <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {preview.race.teams.filter(t => `${t.name} ${t.tag}`.toLowerCase().includes(search.toLowerCase())).map(t => <label key={t.sourceTeamId} className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 text-sm ${selected.includes(t.sourceTeamId) ? "border-brand/50 bg-brand/10" : "border-line"}`}>
              <input type="checkbox" checked={selected.includes(t.sourceTeamId)} disabled={busy} onChange={e => setSelected(ids => e.target.checked ? [...ids, t.sourceTeamId] : ids.filter(id => id !== t.sourceTeamId))} className="mt-1 shrink-0" />
              <span className="min-w-0 break-words"><span className="font-medium">#{t.rank} {t.name}</span><span className="mt-1 block text-xs text-fg-muted">{t.checkpoints ?? "—"} CP · {t.roster.map(p => p.name).join(", ")}</span></span>
            </label>)}
          </div>
          {selectionChanged && <Button variant="outline" onClick={() => loadPreview(true)} disabled={busy || !selected.length}>Load details for selected teams</Button>}
          {!selected.length && <p className="text-sm text-danger">Select at least one B2 team.</p>}
        </CardContent>
      </Card>
      {!selectionChanged && <Card><CardHeader><CardTitle>Driver assignments</CardTitle><p className="text-sm text-fg-muted">Account matches are preselected. Resolve every driver before saving.</p></CardHeader><CardContent className="space-y-3">
        {preview.assignments.map(a => {
          const choice = assignments[a.accountId]
          const driver = preview.race.teams.flatMap(t => t.drivers).find(d => d.accountId === a.accountId)!
          return <div key={a.accountId} className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
            <div className="min-w-0"><p className="break-words font-medium">{a.sourceName}</p><p className="break-all text-xs text-fg-subtle">{a.accountId}</p><p className="mt-1 text-xs text-fg-muted">{driver.checkpoints ?? "—"} CP · {formatTfhDuration(driver.playTimeSeconds)} · {driver.cpm ?? "—"} CPM<br />Best {driver.bestLapMs === null ? "—" : formatTime(driver.bestLapMs)} · Avg {driver.averageLapMs === null ? "—" : formatTime(driver.averageLapMs)} · {driver.finishes.length} finishes</p></div>
            <div className="min-w-0 space-y-2">
              <Select aria-label={`Assign ${a.sourceName}`} disabled={busy} value={choice?.create ? "new" : choice?.playerId ?? ""} onChange={e => setAssignments(all => ({ ...all, [a.accountId]: e.target.value === "new" ? { accountId: a.accountId, create: { name: a.sourceName, status: "GUEST" } } : { accountId: a.accountId, playerId: e.target.value || undefined } }))}>
                <option value="">Choose a player…</option>{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="new">Create a player…</option>
              </Select>
              {choice?.create && <>
                <Input aria-label={`New name for ${a.sourceName}`} value={choice.create.name} disabled={busy} onChange={e => setAssignments(all => ({ ...all, [a.accountId]: { ...choice, create: { ...choice.create!, name: e.target.value } } }))} />
                <Select aria-label={`Status for ${a.sourceName}`} value={choice.create.status} disabled={busy} onChange={e => setAssignments(all => ({ ...all, [a.accountId]: { ...choice, create: { ...choice.create!, status: e.target.value as NonNullable<TfhAssignment["create"]>["status"] } } }))}>
                  <option value="GUEST">Guest</option><option value="MEMBER">Member</option><option value="TRIAL">Trial</option><option value="FORMER">Former member</option>
                </Select>
                <p className="text-xs text-fg-subtle">This status applies from the beginning; dated changes can be added on the player profile.</p>
              </>}
            </div>
          </div>
        })}
      </CardContent></Card>}
      {preview.adoptedTournament && <p className="rounded-lg border border-line bg-surface p-3 text-sm text-fg-muted">The tournament <span className="font-medium text-fg">{preview.adoptedTournament.name}</span> already exists. The race is stored in it instead of a second tournament; its lineups stay as they are.</p>}
      {preview.existingTournamentId && <Card><CardHeader><CardTitle>Changes to the archive ({preview.changes.length})</CardTitle></CardHeader><CardContent>
        {preview.changes.length ? <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">{preview.changes.map((c, i) => <li key={i} className="break-words"><span className="font-medium">{c.label}</span><span className="block text-fg-muted">{c.before} → {c.after}</span></li>)}</ul> : <p className="text-sm text-fg-muted">No source-result changes. You can still correct the driver assignments.</p>}
      </CardContent></Card>}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
        <p className="text-xs text-fg-muted">{unresolved ? "Resolve all driver assignments to continue." : "The reviewed preview will be saved together."}</p>
        <Button onClick={save} disabled={busy || unresolved || selectionChanged || !selected.length}>{busy ? "Saving…" : preview.existingTournamentId ? "Confirm and update race" : "Confirm and import race"}</Button>
      </div>
    </>}
  </div>
}
