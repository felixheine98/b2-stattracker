"use client"
import { useEffect, useState } from "react"
import { BASE_PATH } from "@/lib/base-path"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OpponentLogo } from "./opponent-logo"
import type { OpponentChoices } from "./types"
export interface OpponentValue { name: string; lineupId?: string | null; teamId?: string | null }
export function OpponentPicker({ competitionId, value, onChange, inputId = "opponent" }: { competitionId: string; value: OpponentValue; onChange: (value: OpponentValue) => void; inputId?: string }) {
  const [data, setData] = useState<OpponentChoices | null>(null), [open, setOpen] = useState(false), [archive, setArchive] = useState(false), [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${BASE_PATH}/api/opponents?competitionId=${encodeURIComponent(competitionId)}&archive=${archive ? 1 : 0}`, { signal: controller.signal }).then(async r => {
      const body = await r.json(); if (!r.ok) throw new Error(body.error); setData(body); setError("")
    }).catch(e => { if (e.name !== "AbortError") setError("The opponents could not be loaded. New names can still be entered.") })
    return () => controller.abort()
  }, [competitionId, archive])
  const q = value.name.toLocaleLowerCase()
  const lineups = (data?.lineups ?? []).filter(l => [l.name, ...l.aliases, l.team?.name ?? ""].some(n => n.toLocaleLowerCase().includes(q))).slice(0, 30)
  const teams = (data?.teams ?? []).filter(t => [t.name, ...t.aliases].some(n => n.toLocaleLowerCase().includes(q))).slice(0, 30)
  async function createTeam() {
    try {
      const res = await fetch(`${BASE_PATH}/api/opponents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "team.create", name: value.name }) })
      const body = await res.json(); if (!res.ok) throw new Error(body.error)
      onChange({ name: body.name, teamId: body.id }); setOpen(false)
    } catch (e) { setError((e as Error).message) }
  }
  return <div className="space-y-2">
    <Input id={inputId} name="opponent" aria-label="Find an opponent or add a new one" autoComplete="off" value={value.name} onFocus={() => setOpen(true)} onChange={e => { onChange({ name: e.target.value }); setOpen(true) }} placeholder="Find a team or mix…" />
    {open && <div className="rounded-lg border border-line-strong bg-raised p-2 space-y-2">
      <label className="flex items-center gap-2 text-xs text-fg-muted"><input type="checkbox" checked={archive} onChange={e => setArchive(e.target.checked)} />Show archived</label>
      <div className="max-h-56 overflow-y-auto">
        {lineups.length > 0 && <p className="p-2 text-xs text-fg-muted">In this tournament</p>}
        {lineups.map(l => <button type="button" key={l.id} className="flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-line-strong" onClick={() => { onChange({ name: l.name, lineupId: l.id }); setOpen(false) }}><OpponentLogo name={l.name} logo={l.logo ?? l.team?.logo} size={28} /><span className="min-w-0 break-words">{l.name}{!l.teamId && <span className="ml-2 text-xs text-fg-muted">Mix</span>}{l.archived && " · archived"}</span></button>)}
        {teams.length > 0 && <p className="p-2 text-xs text-fg-muted">Fixed teams</p>}
        {teams.map(t => <button type="button" key={t.id} className="flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-line-strong" onClick={() => { onChange({ name: t.name, teamId: t.id }); setOpen(false) }}><OpponentLogo name={t.name} logo={t.logo} size={28} /><span className="min-w-0 break-words">{t.name}{t.archived && " · archived"}</span></button>)}
      </div>
      {value.name.trim() && <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => { onChange({ name: value.name.trim() }); setOpen(false) }}>Use as a mix</Button><Button type="button" size="sm" variant="secondary" onClick={createTeam}>Add fixed team</Button></div>}
      <button type="button" className="text-xs text-fg-muted" onClick={() => setOpen(false)}>Close selection</button>
    </div>}
    {value.lineupId && <p className="text-xs text-fg-muted">Tournament lineup selected</p>}
    {value.teamId && <p className="text-xs text-fg-muted">Fixed team selected · its tournament lineup is assigned</p>}
    {error && <p className="text-sm text-danger" role="alert">{error}</p>}
  </div>
}
