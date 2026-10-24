"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BASE_PATH } from "@/lib/base-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Plus, TriangleAlert, X } from "lucide-react"
import { vodLinks } from "@/components/vod-links"
import { OpponentPicker, type OpponentValue } from "./opponent-picker"
interface Meta {
  opponent: string | null; opponentLineupId: string | null; date: string | null; notes: string | null; number: number | null; label: string | null; vods: unknown
  opponentLineup: { name: string; logo: string | null; team: { logo: string | null } | null } | null
  closedAt: string | null; confirmedOutcome: string | null; resultRevision: number; suggestedOutcome: string | null
  confirmations: Array<{ id: string; outcome: string; createdAt: string; actor?: string }>
}
const outcomeLabel = (s: string | null) => s === "W" ? "Win" : s === "L" ? "Loss" : s === "D" ? "Draw" : "Open"
// hints: what does not fit the format rules of the tournament; closing asks to confirm them
export function MatchOpponentPanel({ competitionId, matchId, canEdit, results, hints = [] }: { competitionId: string; matchId: string; canEdit: boolean; results: unknown; hints?: string[] }) {
  const router = useRouter(), [meta, setMeta] = useState<Meta | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [edit, setEdit] = useState(false), [closing, setClosing] = useState(false)
  const [value, setValue] = useState<OpponentValue>({ name: "" }), [date, setDate] = useState(""), [notes, setNotes] = useState(""), [number, setNumber] = useState(""), [label, setLabel] = useState(""), [outcome, setOutcome] = useState("W"), [hintsConfirmed, setHintsConfirmed] = useState(false), [vods, setVods] = useState<Array<{ url: string; label: string }>>([])
  const endpoint = `${BASE_PATH}/api/tournaments/${competitionId}/matches/${matchId}/opponent`
  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoint, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setMeta(data); setError("") }).catch(e => { if (e.name !== "AbortError") setError(e.message) })
    return () => controller.abort()
  }, [endpoint, results])
  async function patch(body: object) {
    setBusy(true); setError("")
    try {
      const r = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), data = await r.json()
      if (!r.ok) throw new Error(data.error)
      const fresh = await fetch(endpoint); if (fresh.ok) setMeta(await fresh.json())
      setEdit(false); setClosing(false); router.refresh()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div className="flex flex-wrap justify-end gap-2">
    {canEdit && meta && <><Button variant="outline" size="sm" onClick={() => { setValue({ name: meta.opponent ?? "", lineupId: meta.opponentLineupId }); setDate(meta.date?.slice(0, 10) ?? ""); setNotes(meta.notes ?? ""); setNumber(meta.number?.toString() ?? ""); setLabel(meta.label ?? ""); const stored = vodLinks(meta.vods); setVods(stored.length ? stored.map(v => ({ url: v.url, label: v.label ?? "" })) : [{ url: "", label: "" }]); setEdit(true) }}>Edit match</Button><Button variant={meta.closedAt ? "outline" : "default"} size="sm" disabled={busy} onClick={() => { setOutcome(meta.confirmedOutcome ?? meta.suggestedOutcome ?? "W"); setHintsConfirmed(false); setClosing(true) }}>{meta.closedAt ? "Match closed" : "Close match"}</Button></>}
    {error && <p className="w-full text-right text-sm text-danger" role="alert">{error}</p>}
    {edit && <Dialog open onClose={() => setEdit(false)}><DialogTitle>Edit match</DialogTitle><form className="space-y-4" onSubmit={e => { e.preventDefault(); patch({ action: "edit", opponent: value.name || null, opponentLineupId: value.lineupId, opponentTeamId: value.teamId, date: date || null, notes: notes || null, number: number ? Number(number) : null, label: label.trim() || null, vods }) }}><div><label className="mb-1 block text-sm">Opponent</label><OpponentPicker competitionId={competitionId} value={value} onChange={setValue} /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]"><div><label className="mb-1 block text-sm" htmlFor="edit-match-number">Number</label><Input id="edit-match-number" type="number" min={1} max={999} inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} placeholder="#" /></div><div><label className="mb-1 block text-sm" htmlFor="edit-match-label">Name <span className="text-fg-subtle">(optional)</span></label><Input id="edit-match-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Upper Final" /></div></div><div><label className="mb-1 block text-sm" htmlFor="edit-match-date">Date</label><Input id="edit-match-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div><div><label className="mb-1 block text-sm" htmlFor="edit-match-notes">Notes</label><Textarea id="edit-match-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div><VodFields vods={vods} onChange={setVods} />{error && <p className="text-sm text-danger">{error}</p>}<div className="dialog-footer flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEdit(false)}>Cancel</Button><Button disabled={busy}>Save</Button></div></form></Dialog>}
    {closing && meta && <Dialog open onClose={() => setClosing(false)}><DialogTitle>Confirm the result</DialogTitle>{meta.closedAt && <p className="my-3 text-sm text-fg-muted">{outcomeLabel(meta.confirmedOutcome)} · closed</p>}{meta.confirmations.length > 0 && <details className="my-3 text-xs text-fg-muted"><summary className="cursor-pointer">Earlier confirmations ({meta.confirmations.length})</summary><div className="mt-2 space-y-1">{meta.confirmations.map(c => <p key={c.id}>{outcomeLabel(c.outcome)} · {new Date(c.createdAt).toLocaleString("de-DE")}{c.actor && ` · ${c.actor}`}</p>)}</div></details>}<p className="mb-4 text-sm text-fg-muted">{meta.suggestedOutcome ? `Suggested from the recorded sub-matches: ${outcomeLabel(meta.suggestedOutcome)}.` : "There is no result to work out yet. You can still confirm one, for example for a win by forfeit."} Pick the final result from the point of view of our team.</p><Select aria-label="Final match result" value={outcome} onChange={e => setOutcome(e.target.value)}><option value="W">Win</option><option value="D">Draw</option><option value="L">Loss</option></Select>{hints.length > 0 && <div className="mt-4 space-y-2 rounded-lg border border-bronze/50 bg-bronze/10 px-3 py-2"><p className="flex items-center gap-1.5 text-sm font-medium text-bronze"><TriangleAlert size={14} className="shrink-0" />This match does not fit the format rules in every respect</p><ul className="list-disc space-y-1 pl-5 text-sm text-fg-soft">{hints.map(hint => <li key={hint} className="break-words">{hint}</li>)}</ul><label className="flex cursor-pointer items-start gap-2 text-sm text-fg"><input type="checkbox" checked={hintsConfirmed} onChange={e => setHintsConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand" /><span>Close anyway.</span></label></div>}{error && <p className="mt-3 text-sm text-danger">{error}</p>}<div className="dialog-footer mt-5 flex flex-wrap justify-end gap-2">{meta.closedAt && <Button variant="outline" disabled={busy} onClick={() => patch({ action: "reopen" })}>Reopen</Button>}<Button variant="secondary" onClick={() => setClosing(false)}>Cancel</Button><Button disabled={busy || (hints.length > 0 && !hintsConfirmed)} onClick={() => patch({ action: "confirm", revision: meta.resultRevision, outcome })}>Confirm result</Button></div></Dialog>}
  </div>
}

// VOD links of the match: mostly one Twitch VOD, more (cast, a player's POV) with a name each
function VodFields({ vods, onChange }: { vods: Array<{ url: string; label: string }>; onChange: (vods: Array<{ url: string; label: string }>) => void }) {
  const set = (i: number, change: Partial<{ url: string; label: string }>) => onChange(vods.map((v, j) => j === i ? { ...v, ...change } : v))
  return <div>
    <label className="mb-1 block text-sm" htmlFor="edit-match-vod-0">VOD <span className="text-fg-subtle">(optional)</span></label>
    <div className="space-y-2">
      {vods.map((v, i) => <div key={i} className="flex gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem]">
          <Input id={`edit-match-vod-${i}`} type="url" inputMode="url" value={v.url} onChange={e => set(i, { url: e.target.value })} placeholder="https://www.twitch.tv/videos/…" maxLength={500} />
          {vods.length > 1 && <Input aria-label="Name of the VOD" value={v.label} onChange={e => set(i, { label: e.target.value })} placeholder="Name, e.g. Cast" maxLength={60} />}
        </div>
        {(vods.length > 1 || v.url) && <Button type="button" variant="ghost" size="sm" aria-label="Remove VOD" onClick={() => onChange(vods.length > 1 ? vods.filter((_, j) => j !== i) : [{ url: "", label: "" }])}><X size={14} /></Button>}
      </div>)}
    </div>
    <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => onChange([...vods, { url: "", label: "" }])}><Plus size={14} />Add another VOD</Button>
  </div>
}
