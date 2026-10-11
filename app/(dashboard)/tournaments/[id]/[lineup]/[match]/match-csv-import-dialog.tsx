"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { BASE_PATH } from "@/lib/base-path"
import { blockDrivers, parseMatchCsv, planBlock, suspiciousRounds, type CsvBlock } from "@/lib/match-csv"
import { cn, formatLabel, formatTime, teamSize } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { ArrowLeftRight, TriangleAlert, Upload } from "lucide-react"
import { useState } from "react"

interface Props {
  tournamentId: string
  matchId: string
  // In playing order
  subMatches: Array<{ id: string; format: Format; rounds: unknown[] }>
  // Our players, to tell the sides apart by their Trackmania account
  ownPlayers: Array<{ tmId: string; name: string }>
  // Admin or manager: may put an unknown driver on our side, which adds them as a guest
  canManage: boolean
  onClose: () => void
  onImported: () => void
}

const selectClass = "h-9 rounded-md border border-[#3a3435] bg-[#251f20] px-2 text-sm text-[#f5f0f0] focus:outline-none focus:ring-2 focus:ring-[#FBD00D]"

// Import of a whole match from the CSV of a match dumper. Nothing is saved before the user
// has seen what the file was turned into: which rounds go to which sub-match, who drives
// for whom, which rounds are left out and who is counted as not finished.
export function MatchCsvImportDialog({ tournamentId, matchId, subMatches, ownPlayers, canManage, onClose, onImported }: Props) {
  const [blocks, setBlocks] = useState<CsvBlock[]>([])
  const [fileNames, setFileNames] = useState<string[]>([])
  // Sub-match of every block, "" for a block that is left out
  const [targets, setTargets] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Drivers moved to the other side than the one the system would put them on
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const knownTmIds = new Set(ownPlayers.map((p) => p.tmId.toLowerCase()))
  const isOurs = (tmId: string) => knownTmIds.has(tmId) !== moved.has(tmId)
  const sizeOf = (i: number) => {
    const format = subMatches.find((sm) => sm.id === targets[i])?.format
    return format ? teamSize(format) : null
  }

  async function loadFiles(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    setError("")
    try {
      const parsed = parseMatchCsv(await Promise.all(files.map((f) => f.text())))
      if (parsed.length === 0) throw new Error("Die Datei enthält keine Runden")
      const initialTargets = parsed.map((_, i) => subMatches[i]?.id ?? "")
      setBlocks(parsed)
      setFileNames(files.map((f) => f.name))
      setTargets(initialTargets)
      setMoved(new Set())
      // Everything is selected but the rounds that look like a mistake of the dumper
      setSelected(new Set(parsed.flatMap((block, i) => {
        const format = subMatches.find((sm) => sm.id === initialTargets[i])?.format
        const suspicious = suspiciousRounds(block, format ? teamSize(format) : null)
        return block.rounds.filter((r) => !suspicious.has(r.key)).map((r) => r.key)
      })))
    } catch (e) {
      setBlocks([])
      setError(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden")
    }
  }

  function toggleRound(key: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function move(tmId: string) {
    setMoved((s) => {
      const next = new Set(s)
      if (next.has(tmId)) next.delete(tmId)
      else next.add(tmId)
      return next
    })
  }

  const ourTmIds = new Set(blocks.flatMap((b) => blockDrivers(b).map((d) => d.tmId)).filter(isOurs))
  const plans = blocks.map((block, i) => planBlock(block, selected, ourTmIds, sizeOf(i)))
  // Drivers on our side the system does not know yet
  const drivers = new Map(blocks.flatMap((b) => blockDrivers(b)).map((d) => [d.tmId, d.name]))
  const guests = [...ourTmIds].filter((tmId) => !knownTmIds.has(tmId)).map((tmId) => ({ tmId, name: drivers.get(tmId) ?? tmId }))

  const importing = blocks.flatMap((_, i) => (targets[i] && plans[i].rounds.length > 0 ? [i] : []))
  const roundCount = importing.reduce((sum, i) => sum + plans[i].rounds.length, 0)
  const replaced = importing.reduce((sum, i) => sum + (subMatches.find((sm) => sm.id === targets[i])?.rounds.length ?? 0), 0)
  const doubled = targets.some((t, i) => t && targets.indexOf(t) !== i)

  async function handleSave() {
    setError("")
    setSaving(true)
    const res = await fetch(`${BASE_PATH}/api/tournaments/${tournamentId}/matches/${matchId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: importing.map((i) => ({
          subMatchId: targets[i],
          track: blocks[i].track,
          rounds: plans[i].rounds.map((r) => ({ time: r.time, results: r.results })),
        })),
        guests,
      }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Der Import ist fehlgeschlagen")
      return
    }
    onImported()
    onClose()
  }

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogTitle>Ganzes Match importieren (CSV)</DialogTitle>
      <div className="space-y-5">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFiles(e.dataTransfer.files) }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
            dragOver ? "border-[#FBD00D] bg-[#FBD00D]/5" : "border-[#3a3435] hover:border-[#5e5858]"
          )}
        >
          <Upload size={18} className="text-[#9a9090]" />
          <span className="text-sm text-[#f5f0f0]">{fileNames.length > 0 ? fileNames.join(", ") : "CSV des Match Dumpers wählen oder hierher ziehen"}</span>
          <span className="text-xs text-[#5e5858]">Eine Datei für das ganze Match oder mehrere, zum Beispiel eine pro Map. Gespeichert wird erst nach der Vorschau.</span>
          <input type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => loadFiles(e.target.files)} />
        </label>

        {blocks.length > 0 && (
          <>
            {guests.length > 0 && (
              <p className="rounded-lg border border-[#002484]/50 bg-[#002484]/15 px-3 py-2 text-xs text-[#6b8fff]">
                Wird als Gast angelegt: {guests.map((g) => g.name).join(", ")}
              </p>
            )}

            {blocks.map((block, i) => {
              const plan = plans[i]
              const suspicious = suspiciousRounds(block, sizeOf(i))
              const target = subMatches.find((sm) => sm.id === targets[i])
              const sides = [
                { label: "Wir", list: blockDrivers(block).filter((d) => ourTmIds.has(d.tmId)) },
                { label: "Gegner", list: blockDrivers(block).filter((d) => !ourTmIds.has(d.tmId)) },
              ]
              return (
                <section key={i} className="space-y-3 rounded-xl border border-[#2d2829] bg-[#0e0c0d] p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3 className="min-w-0 break-words text-sm font-semibold text-[#f5f0f0]">{block.track || "Ohne Map"}</h3>
                    <span className="text-xs text-[#9a9090]">{plan.rounds.length} von {block.rounds.length} Runden</span>
                    <select
                      value={targets[i]}
                      onChange={(e) => setTargets((t) => t.map((old, j) => (j === i ? e.target.value : old)))}
                      aria-label={`Sub-Match für ${block.track}`}
                      className={cn(selectClass, "ml-auto max-md:ml-0 max-md:w-full")}
                    >
                      <option value="">— nicht importieren —</option>
                      {subMatches.map((sm, n) => (
                        <option key={sm.id} value={sm.id}>Sub-Match {n + 1} · {formatLabel(sm.format)}</option>
                      ))}
                    </select>
                  </div>

                  {target && target.rounds.length > 0 && (
                    <p className="text-xs text-[#cd7f32]">Ersetzt {target.rounds.length} vorhandene Runden dieses Sub-Matches.</p>
                  )}
                  {targets[i] && plan.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-1.5 text-xs text-[#cd7f32]">
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                      {w}{target ? ` (${formatLabel(target.format)})` : ""}. Prüf die Seiten oder das Sub-Match.
                    </p>
                  ))}

                  {/* Who drives for whom; a click moves a driver to the other side, for the whole match */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {sides.map((side) => (
                      <div key={side.label}>
                        <p className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wider", side.label === "Wir" ? "text-[#FBD00D]" : "text-[#5e5858]")}>{side.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {side.list.length === 0 && <span className="text-xs text-[#5e5858]">niemand</span>}
                          {side.list.map((d) => {
                            // Putting an unknown driver on our side adds a guest, which only managers may do
                            const blocked = !canManage && !knownTmIds.has(d.tmId) && !ourTmIds.has(d.tmId)
                            return (
                              <button
                                key={d.tmId}
                                type="button"
                                onClick={() => move(d.tmId)}
                                disabled={blocked}
                                title={blocked ? "Nicht im System: Ein Admin oder Manager muss den Fahrer erst als Gast anlegen" : "Auf die andere Seite setzen"}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[#2d2829] bg-[#251f20] px-2.5 py-1 text-xs text-[#c5bfbf] hover:border-[#5e5858] hover:text-[#f5f0f0] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {d.name}
                                {!knownTmIds.has(d.tmId) && ourTmIds.has(d.tmId) && <span className="text-[#6b8fff]">neu</span>}
                                <ArrowLeftRight size={11} className="text-[#5e5858]" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <ul className="divide-y divide-[#1c1819] rounded-lg border border-[#2d2829]">
                    {block.rounds.map((round) => {
                      const on = selected.has(round.key)
                      const planned = plan.rounds.find((r) => r.key === round.key)
                      const winner = round.entries.find((e) => e.timeMs !== null)
                      const reason = suspicious.get(round.key)
                      return (
                        <li key={round.key}>
                          <label className={cn("flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-xs", !on && "opacity-60")}>
                            <input type="checkbox" checked={on} onChange={() => toggleRound(round.key)} className="h-4 w-4 accent-[#FBD00D]" />
                            <span className="w-16 font-medium text-[#f5f0f0]">Runde {round.number}</span>
                            <span className="w-14 text-[#9a9090]">{round.entries.filter((e) => e.timeMs !== null).length} Fahrer</span>
                            {winner && <span className="font-mono text-[#c5bfbf]">{winner.name} {formatTime(winner.timeMs!)}</span>}
                            {reason && <span className="text-[#cd7f32]">{reason}</span>}
                            {planned && planned.dnfs.length > 0 && <span className="text-[#9a9090]">DNF: {planned.dnfs.join(", ")}</span>}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </>
        )}

        {doubled && <p className="text-sm text-[#ED1F24]">Zwei Blöcke zeigen auf dasselbe Sub-Match. Jeder Block braucht ein eigenes.</p>}
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
        <div className="dialog-footer flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving || roundCount === 0 || doubled}>
            {saving ? "Importiert …" : `${roundCount} Runden importieren${replaced > 0 ? ` (ersetzt ${replaced})` : ""}`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
