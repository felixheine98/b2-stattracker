"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BASE_PATH } from "@/lib/base-path"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TmioPlayer } from "@/lib/tmio"
interface Appearance { id: string; tmId: string; playerName: string; round: { number: number; track: string | null; subMatch: { match: { opponent: string | null; tournament: { name: string } } } } }
interface RosterPerson { id: string; name: string; tmId: string; opponentTeamSlots: Array<{ team: { name: string } }>; opponentLineupSlots: Array<{ lineup: { name: string; tournament: { name: string } } }> }
export function IdentityDialog({ name, onClose }: { name: string; onClose: () => void }) {
  const router = useRouter(), [query, setQuery] = useState(name), [found, setFound] = useState<TmioPlayer[]>([]), [target, setTarget] = useState<TmioPlayer | null>(null)
  const [results, setResults] = useState<Appearance[]>([]), [roster, setRoster] = useState<RosterPerson[]>([])
  const [resultIds, setResultIds] = useState<string[]>([]), [rosterIds, setRosterIds] = useState<string[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${BASE_PATH}/api/opponents/identities?name=${encodeURIComponent(name)}`, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setResults(data.results); setRoster(data.rosterPlayers) }).catch(e => { if (e.name !== "AbortError") setError(e.message) })
    return () => controller.abort()
  }, [name])
  async function search() {
    setBusy(true); setError("")
    try { const r = await fetch(`${BASE_PATH}/api/tmio/search?q=${encodeURIComponent(query)}`); const data = await r.json(); if (!r.ok) throw new Error(data.error); setFound(data.results); setTarget(null) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function assign() {
    setBusy(true); setError("")
    try {
      const r = await fetch(`${BASE_PATH}/api/opponents/identities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmId: target?.id, resultIds, rosterPlayerIds: rosterIds }) })
      const data = await r.json(); if (!r.ok) throw new Error(data.error)
      router.refresh(); onClose()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} className="max-w-3xl"><DialogTitle>Assign “{name}” to an account</DialogTitle>
    <p className="mb-4 text-sm text-fg-muted">Pick the Trackmania account and the appearances or roster entries that belong to it. The selection applies across all tournaments.</p>
    <div className="flex flex-wrap gap-2"><Input aria-label="Trackmania.io search" className="flex-1 min-w-0" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, account ID or profile link" /><Button type="button" onClick={search} disabled={busy || query.trim().length < 3}>Search</Button></div>
    <div className="my-3 space-y-1">{found.map(p => <label key={p.id} className="flex gap-2 rounded border border-line-strong p-2 text-sm"><input type="radio" name="tmio-target" checked={target?.id === p.id} onChange={() => setTarget(p)} /><span className="min-w-0 break-words">{p.name} {p.country && `· ${p.country.toUpperCase()}`}<span className="block text-xs text-fg-muted break-all">{p.id}</span></span></label>)}</div>
    <h3 className="mb-2 font-semibold">Roster entries</h3>
    {roster.length === 0 && <p className="text-sm text-fg-muted">No roster entries with this name.</p>}
    <div className="space-y-2">{roster.map(p => <label key={p.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={rosterIds.includes(p.id)} onChange={e => setRosterIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} /><span className="break-words">{p.name} · {[...p.opponentTeamSlots.map(s => s.team.name), ...p.opponentLineupSlots.map(s => `${s.lineup.name} (${s.lineup.tournament.name})`)].join(", ")}</span></label>)}</div>
    <div className="mt-5 mb-2 flex flex-wrap items-center gap-2"><h3 className="font-semibold">Actual appearances ({results.length})</h3><Button type="button" size="sm" variant="secondary" onClick={() => setResultIds(resultIds.length === results.length ? [] : results.map(r => r.id))}>{resultIds.length === results.length ? "Deselect all" : "Select all"}</Button></div>
    <div className="max-h-72 overflow-y-auto space-y-2">{results.map(r => <label key={r.id} className="flex items-start gap-2 rounded border border-line-strong p-2 text-sm"><input type="checkbox" checked={resultIds.includes(r.id)} onChange={e => setResultIds(ids => e.target.checked ? [...ids, r.id] : ids.filter(id => id !== r.id))} /><span className="min-w-0 break-words">{r.round.subMatch.match.tournament.name} · {r.round.subMatch.match.opponent}<span className="block text-xs text-fg-muted">{r.round.track || "Unknown map"} · round {r.round.number + 1} · {r.tmId.startsWith("ecm-") || r.tmId.startsWith("unknown-") ? "Identity unconfirmed" : "Account already known"}</span></span></label>)}</div>
    {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
    <div className="dialog-footer mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" onClick={assign} disabled={busy || !target || resultIds.length + rosterIds.length === 0}>{busy ? "Please wait…" : "Assign selection"}</Button></div>
  </Dialog>
}
