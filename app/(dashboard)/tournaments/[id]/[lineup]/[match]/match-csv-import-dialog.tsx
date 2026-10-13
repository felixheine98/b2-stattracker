"use client"

import { ImportCheckPanel } from "@/components/import-check-panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { BASE_PATH } from "@/lib/base-path"
import { useImportCheck } from "@/lib/use-import-check"
import { blockDrivers, parseMatchCsv, planBlock, suspiciousRounds, type CsvBlock } from "@/lib/match-csv"
import { subMatchState, type RuleRound, type RuleSet } from "@/lib/match-rules"
import { cn, formatLabel, formatTime, teamSize } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { ArrowLeftRight, TriangleAlert, Upload } from "lucide-react"
import { useState } from "react"

interface Props {
  tournamentId: string
  matchId: string
  // In playing order
  subMatches: Array<{ id: string; format: Format; rounds: unknown[] }>
  // Format rules of this match: what would be saved is checked against them, as a warning only
  ruleSet: RuleSet | null
  // Our players, to tell the sides apart by their Trackmania account
  ownPlayers: Array<{ tmId: string; name: string }>
  // Admin or manager: may put an unknown driver on our side, which adds them as a guest
  canManage: boolean
  onClose: () => void
  onImported: () => void
}

const selectClass = "h-9 rounded-md border border-line-strong bg-raised px-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand"

// Import of a whole match from the CSV of a match dumper. Nothing is saved before the user
// has seen what the file was turned into: which rounds go to which sub-match, who drives
// for whom, which rounds are left out and who is counted as not finished.
export function MatchCsvImportDialog({ tournamentId, matchId, subMatches, ruleSet, ownPlayers, canManage, onClose, onImported }: Props) {
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
      if (parsed.length === 0) throw new Error("The file contains no rounds")
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
      setError(e instanceof Error ? e.message : "The file could not be read")
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
  // Follows the selection of rounds: what the sub-match would stand at does not fit its rule
  const ruleHint = (rounds: RuleRound[], format: Format) => subMatchState(rounds, ruleSet?.formatRules[format] ?? null).hint
  // Drivers on our side the system does not know yet
  const drivers = new Map(blocks.flatMap((b) => blockDrivers(b)).map((d) => [d.tmId, d.name]))
  const guests = [...ourTmIds].filter((tmId) => !knownTmIds.has(tmId)).map((tmId) => ({ tmId, name: drivers.get(tmId) ?? tmId }))

  const importing = blocks.flatMap((_, i) => (targets[i] && plans[i].rounds.length > 0 ? [i] : []))
  const roundCount = importing.reduce((sum, i) => sum + plans[i].rounds.length, 0)
  const replaced = importing.reduce((sum, i) => sum + (subMatches.find((sm) => sm.id === targets[i])?.rounds.length ?? 0), 0)
  const doubled = targets.some((t, i) => t && targets.indexOf(t) !== i)

  // What would be saved, compared with what is entered for the match
  const imported = importing.flatMap((i) => plans[i].rounds)
  const side = (ours: boolean) => [...new Map(imported.flatMap((r) => r.results.filter((x) => x.isOurTeam === ours).map((x) => [x.tmId, { tmId: x.tmId, name: x.name }] as const))).values()]
  const times = imported.map((r) => r.time).filter((t) => t > 0)
  const check = useImportCheck(tournamentId, matchId, roundCount > 0 ? { ours: side(true), foreign: side(false), firstRoundTime: times.length > 0 ? Math.min(...times) : null } : null)

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
        warnings: check.warnings,
        date: check.date,
      }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "The import failed")
      return
    }
    onImported()
    onClose()
  }

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogTitle>Import whole match (CSV)</DialogTitle>
      <div className="space-y-5">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFiles(e.dataTransfer.files) }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
            dragOver ? "border-brand bg-brand/5" : "border-line-strong hover:border-fg-subtle"
          )}
        >
          <Upload size={18} className="text-fg-muted" />
          <span className="text-sm text-fg">{fileNames.length > 0 ? fileNames.join(", ") : "Pick the match dumper's CSV or drop it here"}</span>
          <span className="text-xs text-fg-subtle">One file for the whole match or several, for example one per map. Nothing is saved before the preview.</span>
          <input type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => loadFiles(e.target.files)} />
        </label>

        {blocks.length > 0 && (
          <>
            {guests.length > 0 && (
              <p className="rounded-lg border border-navy/50 bg-navy/15 px-3 py-2 text-xs text-info">
                Will be added as a guest: {guests.map((g) => g.name).join(", ")}
              </p>
            )}

            {blocks.map((block, i) => {
              const plan = plans[i]
              const suspicious = suspiciousRounds(block, sizeOf(i))
              const target = subMatches.find((sm) => sm.id === targets[i])
              const sides = [
                { label: "Us", list: blockDrivers(block).filter((d) => ourTmIds.has(d.tmId)) },
                { label: "Opponent", list: blockDrivers(block).filter((d) => !ourTmIds.has(d.tmId)) },
              ]
              return (
                <section key={i} className="space-y-3 rounded-xl border border-line bg-canvas p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3 className="min-w-0 break-words text-sm font-semibold text-fg">{block.track || "No map"}</h3>
                    <span className="text-xs text-fg-muted">{plan.rounds.length} of {block.rounds.length} rounds</span>
                    <select
                      value={targets[i]}
                      onChange={(e) => setTargets((t) => t.map((old, j) => (j === i ? e.target.value : old)))}
                      aria-label={`Sub-match for ${block.track}`}
                      className={cn(selectClass, "ml-auto max-md:ml-0 max-md:w-full")}
                    >
                      <option value="">— do not import —</option>
                      {subMatches.map((sm, n) => (
                        <option key={sm.id} value={sm.id}>Sub-match {n + 1} · {formatLabel(sm.format)}</option>
                      ))}
                    </select>
                  </div>

                  {target && target.rounds.length > 0 && (
                    <p className="text-xs text-bronze">Replaces the {target.rounds.length} rounds this sub-match already has.</p>
                  )}
                  {target && ruleHint(plan.rounds, target.format) && (
                    <p className="flex items-start gap-1.5 text-xs text-bronze">
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                      {ruleHint(plan.rounds, target.format)} ({formatLabel(target.format)}). Check the selected rounds.
                    </p>
                  )}
                  {targets[i] && plan.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-1.5 text-xs text-bronze">
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                      {w}{target ? ` (${formatLabel(target.format)})` : ""}. Check the sides or the sub-match.
                    </p>
                  ))}

                  {/* Who drives for whom; a click moves a driver to the other side, for the whole match */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {sides.map((side) => (
                      <div key={side.label}>
                        <p className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wider", side.label === "Us" ? "text-brand-ink" : "text-fg-subtle")}>{side.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {side.list.length === 0 && <span className="text-xs text-fg-subtle">nobody</span>}
                          {side.list.map((d) => {
                            // Putting an unknown driver on our side adds a guest, which only managers may do
                            const blocked = !canManage && !knownTmIds.has(d.tmId) && !ourTmIds.has(d.tmId)
                            return (
                              <button
                                key={d.tmId}
                                type="button"
                                onClick={() => move(d.tmId)}
                                disabled={blocked}
                                title={blocked ? "Not in the system: an admin or manager has to add the driver as a guest first" : "Move to the other side"}
                                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-xs text-fg-soft hover:border-fg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {d.name}
                                {!knownTmIds.has(d.tmId) && ourTmIds.has(d.tmId) && <span className="text-info">new</span>}
                                <ArrowLeftRight size={11} className="text-fg-subtle" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <ul className="divide-y divide-surface rounded-lg border border-line">
                    {block.rounds.map((round) => {
                      const on = selected.has(round.key)
                      const planned = plan.rounds.find((r) => r.key === round.key)
                      const winner = round.entries.find((e) => e.timeMs !== null)
                      const reason = suspicious.get(round.key)
                      return (
                        <li key={round.key}>
                          <label className={cn("flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-xs", !on && "opacity-60")}>
                            <input type="checkbox" checked={on} onChange={() => toggleRound(round.key)} className="h-4 w-4 accent-brand" />
                            <span className="w-16 font-medium text-fg">Round {round.number}</span>
                            <span className="w-14 text-fg-muted">{round.entries.filter((e) => e.timeMs !== null).length} drivers</span>
                            {winner && <span className="font-mono text-fg-soft">{winner.name} {formatTime(winner.timeMs!)}</span>}
                            {reason && <span className="text-bronze">{reason}</span>}
                            {planned && planned.dnfs.length > 0 && <span className="text-fg-muted">DNF: {planned.dnfs.join(", ")}</span>}
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

        <ImportCheckPanel check={check} />
        {doubled && <p className="text-sm text-danger">Two blocks point to the same sub-match. Every block needs its own.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="dialog-footer flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || roundCount === 0 || doubled || !check.ready}>
            {saving ? "Importing…" : `Import ${roundCount} rounds${replaced > 0 ? ` (replaces ${replaced})` : ""}`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
