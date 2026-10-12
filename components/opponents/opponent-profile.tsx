"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Archive, Plus, RefreshCw } from "lucide-react"
import { BASE_PATH } from "@/lib/base-path"
import { confirmedTmId, opponentStats, matchingTeamLineups } from "@/lib/opponents"
import { useSyncedState } from "@/lib/use-synced-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { OpponentLogo } from "./opponent-logo"
import { OpponentStatistics } from "./opponent-statistics"
import { OpponentHistory } from "./opponent-history"
import { IdentityDialog } from "./identity-dialog"
import { SheetDialog } from "./sheet-dialog"
import type { TeamData, LineupData, OpponentChoices, HistoryMatch } from "./types"
interface Props { kind: "team" | "lineup"; entity: TeamData | LineupData; choices: OpponentChoices; matches: HistoryMatch[]; relatedIds: string[]; canEdit: boolean; canAssign: boolean; isAdmin: boolean }
export function OpponentProfile({ kind, entity, choices, matches, relatedIds, canEdit, canAssign, isAdmin }: Props) {
  const router = useRouter(), lineup = kind === "lineup" ? entity as LineupData : null, team = kind === "team" ? entity as TeamData : choices.teams.find(t => t.id === lineup?.teamId)
  const initialFields = useMemo(() => ({ name: entity.name, notes: lineup?.notes ?? "", logo: entity.logo, teamId: lineup?.teamId ?? "", playerIds: entity.slots.map(s => s.player.id) }), [entity, lineup])
  const [fields, setFields] = useSyncedState(initialFields)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [identity, setIdentity] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false), [related, setRelated] = useState(false), [dialog, setDialog] = useState<"add" | "reuse" | "sync" | "merge" | "link" | null>(null)
  const [newName, setNewName] = useState(""), [existingPerson, setExistingPerson] = useState(""), [competition, setCompetition] = useState(choices.tournaments.find(t => t.id !== lineup?.tournamentId)?.id ?? ""), [copyRoster, setCopyRoster] = useState(true), [syncIds, setSyncIds] = useState<string[]>([]), [mergeId, setMergeId] = useState("")
  const visibleMatches = matches.filter(m => kind === "team" || related || m.opponentLineupId === entity.id)
  const stats = opponentStats(visibleMatches)
  const actualPeople = [...new Map(visibleMatches.flatMap(m => m.subMatches.flatMap(sm => sm.rounds.flatMap(r => r.results.filter(p => !p.isOurTeam && !p.tmId.startsWith("opponent-")).map(p => [p.playerId ?? p.tmId, p] as const)))).reverse()).values()]
  const syncPeople = [...new Map([...(team?.slots ?? []), ...entity.slots].map(s => [s.player.id, s.player])).values()]
  const otherParticipations = choices.lineups.filter(l => relatedIds.includes(l.id) && l.id !== entity.id)
  async function mutate(payload: object, close = false) {
    setBusy(true); setError(""); setMessage("")
    try {
      const r = await fetch(`${BASE_PATH}/api/opponents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await r.json(); if (!r.ok) throw new Error(data.error)
      if (close) setDialog(null)
      router.refresh(); setMessage("Saved.")
      return data
    } catch (e) { setError((e as Error).message); return null } finally { setBusy(false) }
  }
  async function upload(file?: File) {
    if (!file) return
    if (file.size > 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Please pick a PNG, JPEG or WebP of up to 1 MB."); return }
    const reader = new FileReader()
    reader.onload = () => setFields(f => ({ ...f, logo: String(reader.result) }))
    reader.readAsDataURL(file)
  }
  async function submitDialog(e: React.FormEvent) {
    e.preventDefault()
    if (dialog === "add") await mutate({ action: "roster.add", kind, id: entity.id, name: newName || choices.players?.find(p => p.id === existingPerson)?.name, playerId: existingPerson || undefined }, true)
    if (dialog === "link") await mutate({ action: "team.linkLineups", id: entity.id, lineupIds: syncIds }, true)
    if (dialog === "sync") await mutate({ action: "lineup.edit", id: entity.id, playerIds: syncIds }, true)
    if (dialog === "merge") {
      if (!confirm("Merge these teams? Tournament lineups and matches are kept.")) return
      const result = await mutate({ action: "team.merge", id: entity.id, targetId: mergeId }, true)
      if (result) router.push(`/opponents/${result.id}?kind=team`)
    }
    if (dialog === "reuse") {
      const result = await mutate({ action: "lineup.create", tournamentId: competition, ...(lineup ? { previousId: lineup.id, copyRoster } : { teamId: entity.id }), name: newName || undefined }, true)
      if (result) router.push(`/opponents/${result.id}`)
    }
  }
  return <div className="max-w-5xl space-y-6">
    <Link href="/opponents" className="inline-flex items-center gap-2 text-sm text-fg-muted"><ArrowLeft size={14} />Opponents</Link>
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><OpponentLogo name={entity.name} logo={entity.logo ?? lineup?.team?.logo} size={64} /><div className="min-w-0"><h1 className="break-words text-2xl font-bold">{entity.name}{entity.archived && " · archived"}</h1><p className="break-words text-sm text-fg-muted">{lineup ? `${lineup.tournament.name} · ${team?.name ?? "Mix team"}` : "Fixed team"}</p></div></div>{canEdit && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setFields(initialFields); setEditing(true) }}>Edit opponent</Button><Button variant="outline" onClick={() => { setDialog("reuse"); setNewName("") }}><Plus size={15} />{lineup ? "Take over into another tournament" : "Add tournament lineup"}</Button><Button variant="outline" onClick={() => mutate({ action: `${kind}.edit`, id: entity.id, archived: !entity.archived })} disabled={busy}><Archive size={15} />{entity.archived ? "Reactivate" : "Archive"}</Button>{kind === "team" && <Button variant="outline" onClick={() => setSheet(true)}><RefreshCw size={15} />{(entity as TeamData).source ? "Review changes" : "Link to the team list"}</Button>}</div>}</div>
    {entity.aliases.length > 0 && <p className="text-xs text-fg-muted">Also known as: {entity.aliases.join(", ")}</p>}
    {error && <p className="text-sm text-danger" role="alert">{error}</p>}{message && <p className="text-sm text-brand-ink" role="status">{message}</p>}
    {lineup?.notes && <section className="rounded-lg border border-line bg-surface p-4"><h2 className="mb-2 font-semibold">Preparation notes</h2><p className="whitespace-pre-wrap break-words text-sm text-fg-soft">{lineup.notes}</p></section>}
    {kind === "team" && <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Tournament lineups</h2>{canEdit && choices.lineups.some(l => !l.teamId) && <Button variant="outline" onClick={() => { setSyncIds(matchingTeamLineups(entity.name, choices.lineups).map(l => l.id)); setDialog("link") }}>Assign existing lineups</Button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{choices.lineups.filter(l => l.teamId === entity.id).map(l => <Link key={l.id} href={`/opponents/${l.id}`} className="rounded-lg border border-line p-3 text-sm"><span className="block break-words font-medium">{l.name}</span><span className="text-fg-muted">{l.tournament.name}</span></Link>)}</div></section>}
    {lineup && otherParticipations.length > 0 && <section className="space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={related} onChange={e => setRelated(e.target.checked)} />Include linked participations in other tournaments in history and stats</label><details className="text-sm"><summary className="cursor-pointer text-fg-muted">Earlier and linked participations / notes</summary><div className="mt-2 space-y-2">{otherParticipations.map(l => <div key={l.id} className="rounded-lg border border-line p-3"><Link href={`/opponents/${l.id}`} className="font-medium hover:text-brand-ink">{l.name} · {l.tournament.name}</Link>{l.notes && <p className="mt-2 whitespace-pre-wrap break-words text-fg-muted">{l.notes}</p>}</div>)}</div></details></section>}
    <OpponentHistory matches={visibleMatches} />
    {canEdit && editing ? <form className="space-y-4 rounded-xl border border-line bg-surface p-4" onSubmit={e => { e.preventDefault(); mutate({ action: `${kind}.edit`, id: entity.id, name: fields.name, logo: fields.logo, playerIds: fields.playerIds, ...(lineup && { notes: fields.notes, teamId: fields.teamId || null }) }) }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="mb-1 block text-sm" htmlFor="opponent-profile-name">Name</label><Input id="opponent-profile-name" required maxLength={100} value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} /></div>{lineup && <div><label className="mb-1 block text-sm">Fixed team</label><Select aria-label="Fixed team of the lineup" value={fields.teamId} onChange={e => setFields(f => ({ ...f, teamId: e.target.value }))}><option value="">Mix without a fixed team</option>{choices.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>}</div>
      <div className="flex flex-wrap items-center gap-3"><OpponentLogo name={fields.name} logo={fields.logo ?? (lineup ? team?.logo : null)} /><label className="text-sm">Upload logo<Input type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 max-w-full" onChange={e => upload(e.target.files?.[0])} /></label>{fields.logo && <Button type="button" size="sm" variant="ghost" onClick={() => setFields(f => ({ ...f, logo: null }))}>{lineup ? "Use the team logo" : "Remove logo"}</Button>}</div>
      {lineup && <div><label className="mb-1 block text-sm" htmlFor="opponent-notes">Preparation notes</label><Textarea id="opponent-notes" value={fields.notes} onChange={e => setFields(f => ({ ...f, notes: e.target.value }))} rows={4} /></div>}
      <h2 className="font-semibold">{lineup ? "Planned lineup roster" : "Current team roster"} ({entity.slots.length})</h2><p className="text-xs text-fg-muted">People you deselect are removed from this roster on saving. Rounds actually driven are kept.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{entity.slots.map(s => <div key={s.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-line-strong p-2 text-sm"><input type="checkbox" aria-label={`Keep ${s.player.name} in the roster`} checked={fields.playerIds.includes(s.player.id)} onChange={e => setFields(f => ({ ...f, playerIds: e.target.checked ? [...f.playerIds, s.player.id] : f.playerIds.filter(id => id !== s.player.id) }))} /><Link href={`/opponents/players/${s.player.id}`} className="break-words hover:text-brand-ink">{s.player.name}</Link>{!confirmedTmId(s.player.tmId) && <span className="text-xs text-fg-muted">unconfirmed</span>}{canAssign && <Button type="button" variant="ghost" size="sm" onClick={() => setIdentity(s.player.name)}>Assign via TM.io</Button>}</div>)}</div>
      <div className="flex flex-wrap justify-between gap-3"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => { setDialog("add"); setNewName(""); setExistingPerson("") }}>Add player</Button>{lineup?.teamId && <Button type="button" variant="outline" onClick={() => { setSyncIds(fields.playerIds); setDialog("sync") }}>Sync with team roster</Button>}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Close editing</Button><Button disabled={busy}>Save changes</Button></div></div>
    </form> : <section className="space-y-3"><h2 className="font-semibold">{lineup ? "Planned lineup roster" : "Current team roster"} ({entity.slots.length})</h2><div className="flex flex-wrap gap-2">{entity.slots.map(slot => <div key={slot.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm"><Link href={`/opponents/players/${slot.player.id}`} className="hover:text-brand-ink">{slot.player.name}</Link>{!confirmedTmId(slot.player.tmId) && <span className="text-xs text-fg-muted">unconfirmed</span>}{canAssign && <Button variant="ghost" size="sm" onClick={() => setIdentity(slot.player.name)}>Assign via TM.io</Button>}</div>)}</div>{!entity.slots.length && <p className="text-sm text-fg-muted">No roster entered.</p>}</section>}
    <section><h2 className="mb-3 font-semibold">Players actually fielded</h2><div className="flex flex-wrap gap-2">{actualPeople.map(p => <div key={p.playerId ?? p.tmId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">{p.playerId ? <Link href={`/opponents/players/${p.playerId}`} className="hover:text-brand-ink">{p.playerName}</Link> : p.playerName}{!confirmedTmId(p.tmId) && <span className="text-xs text-fg-muted">unconfirmed</span>}{canAssign && <Button size="sm" variant="ghost" onClick={() => setIdentity(p.playerName)}>Assign</Button>}</div>)}</div>{actualPeople.length === 0 && <p className="text-sm text-fg-muted">No rounds recorded by name yet.</p>}</section>
    <OpponentStatistics stats={stats} />
    {isAdmin && <div className="flex flex-wrap gap-2 border-t border-line pt-4">{kind === "team" && <Button variant="outline" onClick={() => setDialog("merge")}>Merge with another team</Button>}<Button variant="ghost" onClick={async () => { if (!confirm("Delete this unused entry? Entries with matches are kept.")) return; const result = await mutate({ action: `${kind}.delete`, id: entity.id }); if (result) router.push("/opponents") }}>Delete unused entry</Button></div>}
    {identity && <IdentityDialog name={identity} onClose={() => setIdentity(null)} />}{sheet && kind === "team" && <SheetDialog team={entity as TeamData} onClose={() => setSheet(false)} />}
    {dialog && <Dialog open onClose={() => setDialog(null)}><DialogTitle>{dialog === "add" ? "Add player" : dialog === "sync" ? "Sync with team roster" : dialog === "merge" ? "Merge teams" : dialog === "link" ? "Assign existing lineups" : "Add tournament lineup"}</DialogTitle><form onSubmit={submitDialog} className="space-y-4">
      {dialog === "add" && <><Select aria-label="Pick an existing person" value={existingPerson} onChange={e => setExistingPerson(e.target.value)}><option value="">Add a new person by name</option>{choices.players?.map(p => <option key={p.id} value={p.id}>{p.name}{confirmedTmId(p.tmId) ? "" : " · unconfirmed"}</option>)}</Select>{!existingPerson && <Input aria-label="Name of the new player" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Player name" />}</>}
      {dialog === "sync" && <><p className="text-sm text-fg-muted">Pick the planned roster of this tournament lineup.</p><div className="space-y-2">{syncPeople.map(p => <label key={p.id} className="flex gap-2 text-sm"><input type="checkbox" checked={syncIds.includes(p.id)} onChange={e => setSyncIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} />{p.name}</label>)}</div></>}
      {dialog === "link" && <><p className="text-sm text-fg-muted">Pick the participations of this team so far. Their matches are collected in the team profile; planned rosters and rounds actually driven are kept.</p><div className="space-y-2">{choices.lineups.filter(l => !l.teamId).map(l => <label key={l.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={syncIds.includes(l.id)} onChange={e => setSyncIds(ids => e.target.checked ? [...ids, l.id] : ids.filter(id => id !== l.id))} /><span className="min-w-0 break-words">{l.name} · {l.tournament.name}</span></label>)}</div></>}
      {dialog === "merge" && <Select aria-label="Target team" required value={mergeId} onChange={e => setMergeId(e.target.value)}><option value="">Pick the target team…</option>{choices.teams.filter(t => t.id !== entity.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
      {dialog === "reuse" && <><Select aria-label="Target tournament" required value={competition} onChange={e => setCompetition(e.target.value)}>{choices.tournaments.filter(t => t.id !== lineup?.tournamentId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select><Input aria-label="Name of the tournament lineup" value={newName} onChange={e => setNewName(e.target.value)} placeholder={entity.name} />{lineup && <label className="flex gap-2 text-sm"><input type="checkbox" checked={copyRoster} onChange={e => setCopyRoster(e.target.checked)} />Copy the planned roster as well</label>}</>}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}<div className="dialog-footer flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={busy || dialog === "reuse" && !competition || dialog === "link" && !syncIds.length}>Confirm</Button></div>
    </form></Dialog>}
  </div>
}
