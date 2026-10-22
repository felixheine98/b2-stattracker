"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BASE_PATH } from "@/lib/base-path"
import { useSyncedState } from "@/lib/use-synced-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { OpponentLogo } from "./opponent-logo"
import { SheetDialog } from "./sheet-dialog"
import type { OpponentChoices } from "./types"
import { Plus, Download, Users, Swords } from "lucide-react"
export function OpponentsView({ initial, canEdit }: { initial: OpponentChoices; canEdit: boolean }) {
  const [data] = useSyncedState(initial), router = useRouter()
  const [q, setQ] = useState(""), [competition, setCompetition] = useState(""), [archive, setArchive] = useState(false)
  const [dialog, setDialog] = useState<"team" | "mix" | null>(null), [sheet, setSheet] = useState(false), [name, setName] = useState(""), [compId, setCompId] = useState(initial.tournaments[0]?.id ?? "")
  const [error, setError] = useState(""), [busy, setBusy] = useState(false)
  const query = q.toLocaleLowerCase()
  const teams = data.teams.filter(t => (archive || !t.archived) && [t.name, ...t.aliases].some(n => n.toLocaleLowerCase().includes(query)))
  const lineups = data.lineups.filter(l => (archive || !l.archived) && (!competition || l.tournamentId === competition) && [l.name, ...l.aliases, l.team?.name ?? ""].some(n => n.toLocaleLowerCase().includes(query)))
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("")
    try {
      const res = await fetch(`${BASE_PATH}/api/opponents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dialog === "team" ? { action: "team.create", name } : { action: "lineup.create", name, tournamentId: compId }) })
      const result = await res.json(); if (!res.ok) throw new Error(result.error)
      router.push(`/opponents/${result.id}${dialog === "team" ? "?kind=team" : ""}`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div className="page-wide space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="page-title">Opponents</h1><p className="mt-1 text-sm text-fg-muted">Teams, tournament lineups and your matches against them</p></div>{canEdit && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setSheet(true)}><Download size={16} />Team list</Button><Button variant="outline" onClick={() => { setDialog("mix"); setName(""); setError("") }}><Plus size={16} />Add mix</Button><Button onClick={() => { setDialog("team"); setName(""); setError("") }}><Plus size={16} />Add team</Button></div>}</div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input aria-label="Search opponents" value={q} onChange={e => setQ(e.target.value)} placeholder="Search names or former names…" /><Select aria-label="Filter by tournament" value={competition} onChange={e => setCompetition(e.target.value)}><option value="">All tournaments</option>{data.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
    <label className="flex items-center gap-2 text-sm text-fg-muted"><input type="checkbox" checked={archive} onChange={e => setArchive(e.target.checked)} />Show archived</label>
    <section><h2 className="mb-3 flex items-center gap-2 font-semibold"><Users size={18} />Fixed teams ({teams.length})</h2><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{teams.map(t => <Link key={t.id} href={`/opponents/${t.id}?kind=team`} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-fg-subtle"><OpponentLogo name={t.name} logo={t.logo} /><span className="min-w-0"><span className="block break-words font-medium">{t.name}{t.archived && " · archived"}</span><span className="text-xs text-fg-muted">{t.slots.length} in the team roster · {data.lineups.filter(l => l.teamId === t.id).length} tournament lineups</span></span></Link>)}</div>{!teams.length && <p className="text-sm text-fg-muted">No fixed teams found. Teams can be added directly or taken over one by one from the team list.</p>}</section>
    <section><h2 className="mb-3 flex items-center gap-2 font-semibold"><Swords size={18} />Tournament lineups and mixes ({lineups.length})</h2><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{lineups.map(l => <Link key={l.id} href={`/opponents/${l.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-fg-subtle"><OpponentLogo name={l.name} logo={l.logo ?? l.team?.logo} /><span className="min-w-0"><span className="block break-words font-medium">{l.name}{l.archived && " · archived"}</span><span className="block break-words text-xs text-fg-muted">{l.tournament.name} · {l.team?.name ?? "Mix team"} · {l._count?.matches ?? 0} matches</span></span></Link>)}</div>{!lineups.length && <p className="text-sm text-fg-muted">No tournament lineups found.</p>}</section>
    {dialog && <Dialog open onClose={() => setDialog(null)}><DialogTitle>{dialog === "team" ? "Add fixed team" : "Add mix team"}</DialogTitle><form onSubmit={create} className="space-y-4"><div><label className="mb-1 block text-sm" htmlFor="new-opponent-name">Name</label><Input id="new-opponent-name" autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div>{dialog === "mix" && <div><label className="mb-1 block text-sm">Tournament</label><Select aria-label="Tournament for the mix team" value={compId} onChange={e => setCompId(e.target.value)} required>{data.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>}{error && <p className="text-sm text-danger" role="alert">{error}</p>}<div className="dialog-footer flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={busy || !name.trim() || dialog === "mix" && !compId}>Add</Button></div></form></Dialog>}
    {sheet && <SheetDialog onClose={() => setSheet(false)} />}
  </div>
}
