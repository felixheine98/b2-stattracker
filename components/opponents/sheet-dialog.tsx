"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { readOpponentResponse } from "@/lib/opponent-response"
import { BASE_PATH } from "@/lib/base-path"
import { findRosterIdentity, matchingTeamLineups } from "@/lib/opponents"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OpponentLogo } from "./opponent-logo"
import type { SheetBlock } from "@/lib/opponent-sheet"
import type { TeamData, LinkableLineup } from "./types"
export function SheetDialog({ team, onClose, onSaved }: { team?: TeamData; onClose: () => void; onSaved?: () => void }) {
  const router = useRouter(), [blocks, setBlocks] = useState<SheetBlock[]>([]), [keys, setKeys] = useState<string[]>([]), [excluded, setExcluded] = useState<string[]>([])
  const [unlinkedLineups, setUnlinkedLineups] = useState<LinkableLineup[]>([]), [excludedLineups, setExcludedLineups] = useState<string[]>([])
  const [keep, setKeep] = useState<string[]>(team?.slots.map(s => s.player.id) ?? []), [q, setQ] = useState(""), [name, setName] = useState(team?.name ?? "")
  const [copyName, setCopyName] = useState(true), [copyLogo, setCopyLogo] = useState(true), [copyRoster, setCopyRoster] = useState(true), [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${BASE_PATH}/api/opponents/sheet${team ? `?teamId=${encodeURIComponent(team.id)}` : ""}`, { signal: controller.signal }).then(async r => {
      const data = await readOpponentResponse<{ blocks: SheetBlock[]; unlinkedLineups: LinkableLineup[]; matchedKeys: string[]; excluded: string[]; needsSelection: boolean; difference?: { added: string[]; removed: string[] } }>(r)
      setBlocks(data.blocks); setKeys(data.matchedKeys); setUnlinkedLineups(data.unlinkedLineups ?? [])
      setExcluded(data.excluded ?? [])
      if (data.needsSelection) setNotice("Die bisherigen Teamblöcke wurden nicht eindeutig gefunden. Bitte neu auswählen.")
      else if (team && data.difference) setNotice(`Seit dem letzten Quellstand: ${data.difference.added.length} neue Namen, ${data.difference.removed.length} Namen fehlen jetzt. Deine bisherige Personenauswahl ist vorbelegt.`)
    }).catch(e => { if (e.name !== "AbortError") setError(e.message) }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [team])
  const selected = keys.map(k => blocks.find(b => b.key === k)).filter((b): b is SheetBlock => !!b)
  const matchingLineups = matchingTeamLineups(selected[0]?.name ?? name, unlinkedLineups)
  const proposed = selected.flatMap(b => b.members.map(m => ({ ...m, blockKey: b.key })))
  const localExtras = team?.slots.filter(s => !proposed.some(m => findRosterIdentity([s.player], m.name))) ?? []
  async function save() {
    setBusy(true); setError("")
    try {
      const r = await fetch(`${BASE_PATH}/api/opponents/sheet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: team?.id, name, blocks: selected.map(b => ({ key: b.key, name: b.name })), members: proposed.filter(m => !excluded.includes(`${m.blockKey}:${m.name}`)).map(m => ({ name: m.name, blockKey: m.blockKey })), lineupIds: matchingLineups.filter(l => !excludedLineups.includes(l.id)).map(l => l.id), keepPlayerIds: localExtras.filter(s => keep.includes(s.player.id)).map(s => s.player.id), copyName, copyLogo, copyRoster }) })
      const data = await readOpponentResponse<{ id: string }>(r)
      onSaved?.(); router.refresh(); onClose()
      if (!team) router.push(`/opponents/${data.id}?kind=team`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} className="max-w-3xl"><DialogTitle>{team ? "Änderungen aus Teamliste prüfen" : "Team aus Spreadsheet übernehmen"}</DialogTitle>
    <p className="mb-4 text-sm text-[#9a9090]">Wähle einen Teamblock und bei Bedarf weitere Untergruppen. Übernommen wird nur deine bestätigte Auswahl.</p>
    {notice && <p className="mb-3 text-sm text-[#FBD00D]">{notice}</p>}
    {busy && blocks.length === 0 ? <p className="py-8 text-[#9a9090]">Teamliste wird gelesen …</p> : <>
      <Input aria-label="Team in Spreadsheet suchen" value={q} onChange={e => setQ(e.target.value)} placeholder="Team suchen …" />
      <div className="mt-3 max-h-52 overflow-y-auto space-y-1">{[...blocks.filter(b => keys.includes(b.key)), ...blocks.filter(b => !keys.includes(b.key) && b.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()))].slice(0, 50).map(b => <label key={b.key} className="flex items-center gap-2 rounded border border-[#3a3435] p-2 text-sm"><input type="checkbox" checked={keys.includes(b.key)} onChange={e => { if (e.target.checked) { setKeys(v => [...v, b.key]); if (!name) setName(b.name) } else setKeys(v => v.filter(k => k !== b.key)) }} /><OpponentLogo name={b.name} logo={b.logoUrl ? `${BASE_PATH}/api/opponents/sheet/logo?url=${encodeURIComponent(b.logoUrl)}` : null} size={32} /><span className="min-w-0 break-words">{b.name}<span className="block text-xs text-[#9a9090]">{b.members.length} Personen · Zeile {b.row}</span></span></label>)}</div>
      {selected.length > 0 && <div className="mt-5 space-y-4">
        <div><label className="mb-1 block text-sm">Teamname</label><Input value={name} onChange={e => setName(e.target.value)} aria-label="Name des übernommenen Teams" /></div>
        {team && <div className="flex flex-wrap gap-4 text-sm"><label className="flex gap-2"><input type="checkbox" checked={copyName} onChange={e => setCopyName(e.target.checked)} />Name übernehmen</label><label className="flex gap-2"><input type="checkbox" checked={copyLogo} onChange={e => setCopyLogo(e.target.checked)} />Logo übernehmen</label><label className="flex gap-2"><input type="checkbox" checked={copyRoster} onChange={e => setCopyRoster(e.target.checked)} />Kader übernehmen</label></div>}
        {matchingLineups.length > 0 && <section className="space-y-2"><h3 className="font-semibold">Bestehende Competition-Lineups zuordnen</h3><p className="text-xs text-[#9a9090]">Diese gleichnamigen Lineups sind bisher keinem festen Team zugeordnet. Ihre Begegnungen erscheinen anschließend auch im Teamprofil. Kader und Ergebnisse bleiben erhalten.</p>{matchingLineups.map(l => <label key={l.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!excludedLineups.includes(l.id)} onChange={e => setExcludedLineups(ids => e.target.checked ? ids.filter(id => id !== l.id) : [...ids, l.id])} /><span className="min-w-0 break-words">{l.name} · {l.tournament.name} · {l._count?.matches ?? 0} Begegnungen</span></label>)}</section>}
        {copyLogo && <div className="flex items-center gap-3"><OpponentLogo name={selected[0].name} logo={selected[0].logoUrl ? `${BASE_PATH}/api/opponents/sheet/logo?url=${encodeURIComponent(selected[0].logoUrl)}` : null} size={56} /><p className="text-sm text-[#9a9090]">Logo aus dem zuerst ausgewählten Block</p></div>}
        {copyRoster && <><h3 className="font-semibold">Mitglieder zur Übernahme ({proposed.length})</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{proposed.map(m => <label key={`${m.blockKey}:${m.name}`} className="flex gap-2 text-sm"><input type="checkbox" checked={!excluded.includes(`${m.blockKey}:${m.name}`)} onChange={e => setExcluded(v => e.target.checked ? v.filter(k => k !== `${m.blockKey}:${m.name}`) : [...v, `${m.blockKey}:${m.name}`])} /><span className="break-words">{m.name} · {m.country?.toUpperCase()}</span></label>)}</div>
          {localExtras.length > 0 && <><h3 className="font-semibold">Bisherige Mitglieder zusätzlich behalten</h3><div className="space-y-2">{localExtras.map(s => <label key={s.id} className="flex gap-2 text-sm"><input type="checkbox" checked={keep.includes(s.player.id)} onChange={e => setKeep(ids => e.target.checked ? [...ids, s.player.id] : ids.filter(id => id !== s.player.id))} />{s.player.name}</label>)}</div></>}
          <p className="text-xs text-[#9a9090]">Die Liste liefert Namen ohne Account-IDs. Spieleridentitäten können anschließend über Trackmania.io bestätigt werden. Bestehende Competition-Lineups werden nicht verändert.</p>
        </>}
      </div>}
    </>}
    {error && <p className="mt-3 text-sm text-[#ED1F24]" role="alert">{error}</p>}
    <div className="dialog-footer mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={onClose}>Abbrechen</Button><Button onClick={save} disabled={busy || !name.trim() || !selected.length}>{busy ? "Bitte warten …" : team ? "Auswahl aktualisieren" : "Team übernehmen"}</Button></div>
  </Dialog>
}
