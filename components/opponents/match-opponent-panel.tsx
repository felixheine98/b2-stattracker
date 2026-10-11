"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BASE_PATH } from "@/lib/base-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { OpponentPicker, type OpponentValue } from "./opponent-picker"
interface Meta {
  opponent: string | null; opponentLineupId: string | null; date: string | null; notes: string | null; number: number | null; label: string | null
  opponentLineup: { name: string; logo: string | null; team: { logo: string | null } | null } | null
  closedAt: string | null; confirmedOutcome: string | null; resultRevision: number; suggestedOutcome: string | null
  confirmations: Array<{ id: string; outcome: string; createdAt: string; actor?: string }>
}
const outcomeLabel = (s: string | null) => s === "W" ? "Win" : s === "L" ? "Loss" : s === "D" ? "Draw" : "Open"
export function MatchOpponentPanel({ competitionId, matchId, canEdit, results }: { competitionId: string; matchId: string; canEdit: boolean; results: unknown }) {
  const router = useRouter(), [meta, setMeta] = useState<Meta | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [edit, setEdit] = useState(false), [closing, setClosing] = useState(false)
  const [value, setValue] = useState<OpponentValue>({ name: "" }), [date, setDate] = useState(""), [notes, setNotes] = useState(""), [number, setNumber] = useState(""), [label, setLabel] = useState(""), [outcome, setOutcome] = useState("W")
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
    {canEdit && meta && <><Button variant="outline" size="sm" onClick={() => { setValue({ name: meta.opponent ?? "", lineupId: meta.opponentLineupId }); setDate(meta.date?.slice(0, 10) ?? ""); setNotes(meta.notes ?? ""); setNumber(meta.number?.toString() ?? ""); setLabel(meta.label ?? ""); setEdit(true) }}>Edit match</Button><Button variant={meta.closedAt ? "outline" : "default"} size="sm" disabled={busy} onClick={() => { setOutcome(meta.confirmedOutcome ?? meta.suggestedOutcome ?? "W"); setClosing(true) }}>{meta.closedAt ? "Match closed" : "Close match"}</Button></>}
    {error && <p className="w-full text-right text-sm text-[#ED1F24]" role="alert">{error}</p>}
    {edit && <Dialog open onClose={() => setEdit(false)}><DialogTitle>Edit match</DialogTitle><form className="space-y-4" onSubmit={e => { e.preventDefault(); patch({ action: "edit", opponent: value.name || null, opponentLineupId: value.lineupId, opponentTeamId: value.teamId, date: date || null, notes: notes || null, number: number ? Number(number) : null, label: label.trim() || null }) }}><div><label className="mb-1 block text-sm">Opponent</label><OpponentPicker competitionId={competitionId} value={value} onChange={setValue} /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]"><div><label className="mb-1 block text-sm" htmlFor="edit-match-number">Number</label><Input id="edit-match-number" type="number" min={1} max={999} inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} placeholder="#" /></div><div><label className="mb-1 block text-sm" htmlFor="edit-match-label">Name <span className="text-[#5e5858]">(optional)</span></label><Input id="edit-match-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Upper Final" /></div></div><div><label className="mb-1 block text-sm" htmlFor="edit-match-date">Date</label><Input id="edit-match-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div><div><label className="mb-1 block text-sm" htmlFor="edit-match-notes">Notes</label><Textarea id="edit-match-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>{error && <p className="text-sm text-[#ED1F24]">{error}</p>}<div className="dialog-footer flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEdit(false)}>Cancel</Button><Button disabled={busy}>Save</Button></div></form></Dialog>}
    {closing && meta && <Dialog open onClose={() => setClosing(false)}><DialogTitle>Confirm the result</DialogTitle>{meta.closedAt && <p className="my-3 text-sm text-[#9a9090]">{outcomeLabel(meta.confirmedOutcome)} · closed</p>}{meta.confirmations.length > 0 && <details className="my-3 text-xs text-[#9a9090]"><summary className="cursor-pointer">Earlier confirmations ({meta.confirmations.length})</summary><div className="mt-2 space-y-1">{meta.confirmations.map(c => <p key={c.id}>{outcomeLabel(c.outcome)} · {new Date(c.createdAt).toLocaleString("de-DE")}{c.actor && ` · ${c.actor}`}</p>)}</div></details>}<p className="mb-4 text-sm text-[#9a9090]">{meta.suggestedOutcome ? `Suggested from the recorded sub-matches: ${outcomeLabel(meta.suggestedOutcome)}.` : "There is no result to work out yet. You can still confirm one, for example for a win by forfeit."} Pick the final result from the point of view of our team.</p><Select aria-label="Final match result" value={outcome} onChange={e => setOutcome(e.target.value)}><option value="W">Win</option><option value="D">Draw</option><option value="L">Loss</option></Select>{error && <p className="mt-3 text-sm text-[#ED1F24]">{error}</p>}<div className="dialog-footer mt-5 flex flex-wrap justify-end gap-2">{meta.closedAt && <Button variant="outline" disabled={busy} onClick={() => patch({ action: "reopen" })}>Reopen</Button>}<Button variant="secondary" onClick={() => setClosing(false)}>Cancel</Button><Button disabled={busy} onClick={() => patch({ action: "confirm", revision: meta.resultRevision, outcome })}>Confirm result</Button></div></Dialog>}
  </div>
}
