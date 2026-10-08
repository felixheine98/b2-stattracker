"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn, formatLabel, formatTime, parseTime, teamSize } from "@/lib/utils"
import { ArrowDown, ArrowRight, Hash, Timer } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Player, Round, SubMatch } from "./match-detail-view"

// One round: playerId -> placement
type Column = Record<string, number>
type Direction = "round" | "player"
type Mode = "positions" | "times"

type ColumnState =
  | { kind: "empty" }
  | { kind: "incomplete" }
  | { kind: "invalid"; duplicates: Set<number> }
  | { kind: "done"; ours: number; theirs: number; outcome: "W" | "L" | "D" }

interface Props {
  subMatch: SubMatch
  // Players offered by default (sub-match or match lineup)
  pool: Player[]
  allPlayers: Player[]
  onClose: () => void
  onSaved: (rounds: Round[]) => void
}

// Drops empty rounds at the end and keeps exactly one empty round to type into
function normalize(columns: Column[]): Column[] {
  const out = [...columns]
  while (out.length > 0 && Object.keys(out[out.length - 1]).length === 0) out.pop()
  out.push({})
  return out
}

function columnState(column: Column, playerIds: string[], size: number): ColumnState {
  const values = playerIds.map((id) => column[id]).filter((v) => v != null)
  if (values.length === 0) return { kind: "empty" }
  const duplicates = new Set(values.filter((v, i) => values.indexOf(v) !== i))
  if (duplicates.size > 0) return { kind: "invalid", duplicates }
  if (values.length < size) return { kind: "incomplete" }
  const n = size * 2
  const ours = values.reduce((sum, v) => sum + (n - v + 1), 0)
  const theirs = (n * (n + 1)) / 2 - ours
  return { kind: "done", ours, theirs, outcome: ours > theirs ? "W" : ours < theirs ? "L" : "D" }
}

function placementColor(position: number): string {
  if (position === 1) return "text-[#FBD00D]"
  if (position === 2) return "text-[#c5bfbf]"
  if (position === 3) return "text-[#cd7f32]"
  return "text-[#9a9090]"
}

export function RoundEntryDialog({ subMatch, pool, allPlayers, onClose, onSaved }: Props) {
  const size = teamSize(subMatch.format) ?? 1
  const maxPosition = size * 2

  const [initial] = useState(() => {
    const ids: string[] = []
    // Entered times as text, keyed by "<round index>:<playerId>"
    const times: Record<string, string> = {}
    const columns = subMatch.rounds.map((round, c) => {
      const column: Column = {}
      round.results.forEach((r, idx) => {
        if (!r.isOurTeam || !r.playerId) return
        if (!ids.includes(r.playerId)) ids.push(r.playerId)
        column[r.playerId] = idx + 1
        if (r.timeMs != null) times[`${c}:${r.playerId}`] = formatTime(r.timeMs)
      })
      return column
    })
    if (ids.length === 0 && pool.length === size) ids.push(...pool.map((p) => p.id))
    return { ids, columns: normalize(columns), times }
  })

  const [playerIds, setPlayerIds] = useState(initial.ids)
  const [columns, setColumns] = useState(initial.columns)
  const [times, setTimes] = useState(initial.times)
  const [mode, setMode] = useState<Mode>("positions")
  const [track, setTrack] = useState(subMatch.rounds[0]?.track ?? "")
  const [direction, setDirection] = useState<Direction>("round")
  const [showAllPlayers, setShowAllPlayers] = useState(pool.length === 0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [focusRequest, setFocusRequest] = useState<{ c: number; p: number } | null>({
    c: initial.columns.length - 1,
    p: 0,
  })
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusRequest) return
    const el = gridRef.current?.querySelector<HTMLInputElement>(
      `[data-cell="${focusRequest.c}-${focusRequest.p}"]`
    )
    el?.focus()
    el?.select()
  }, [focusRequest])

  const playerById = useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers])
  const selectablePlayers = showAllPlayers
    ? allPlayers
    : [...pool, ...allPlayers.filter((p) => playerIds.includes(p.id) && !pool.some((q) => q.id === p.id))]

  const ready = playerIds.length === size
  const lastCol = columns.length - 1
  const states = columns.map((column) => columnState(column, playerIds, size))
  const done = states.filter((s) => s.kind === "done")
  const won = done.filter((s) => s.outcome === "W").length
  const lost = done.filter((s) => s.outcome === "L").length
  const drawn = done.filter((s) => s.outcome === "D").length
  const hasProblems = states.some((s) => s.kind === "invalid" || s.kind === "incomplete")
  const hasInvalidTimes = columns.some(
    (_, c) => states[c].kind === "done" && playerIds.some((id) => parseTime(times[`${c}:${id}`] ?? "") === undefined)
  )
  const canSave =
    ready && !hasProblems && !hasInvalidTimes && !saving && (done.length > 0 || subMatch.rounds.length > 0)

  function requestClose() {
    if (dirty && !window.confirm("Eingaben verwerfen?")) return
    onClose()
  }

  function togglePlayer(id: string) {
    setDirty(true)
    setPlayerIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < size ? [...ids, id] : ids))
  }

  function setCells(cells: Array<{ c: number; p: number; value: number | null }>) {
    setDirty(true)
    setError("")
    setColumns((prev) => {
      const next = prev.map((column) => ({ ...column }))
      for (const { c, p, value } of cells) {
        while (next.length <= c) next.push({})
        if (value == null) delete next[c][playerIds[p]]
        else next[c][playerIds[p]] = value
      }
      return normalize(next)
    })
  }

  function focusCell(c: number, p: number) {
    setFocusRequest({ c: Math.max(0, c), p: Math.min(Math.max(0, p), size - 1) })
  }

  function advance(c: number, p: number) {
    if (direction === "round") {
      if (p < size - 1) focusCell(c, p + 1)
      else focusCell(c + 1, 0)
      return
    }
    // The first player defines how many rounds there are, the others wrap at the end
    if (p === 0 || c + 1 < lastCol) focusCell(c + 1, p)
    else if (p < size - 1) focusCell(0, p + 1)
  }

  function previousCell(c: number, p: number): { c: number; p: number } | null {
    if (direction === "round") {
      if (p > 0) return { c, p: p - 1 }
      return c > 0 ? { c: c - 1, p: size - 1 } : null
    }
    return c > 0 ? { c: c - 1, p } : null
  }

  function handleInput(c: number, p: number, raw: string) {
    const digits = raw.replace(/\D/g, "")
    if (!digits) {
      setCells([{ c, p, value: null }])
      return
    }
    let value = Number(digits.slice(-1))
    // Two-digit placements only exist in 5v5: 0 is the shortcut for 10
    if (value === 0 && maxPosition >= 10) value = 10
    if (value < 1 || value > maxPosition) return
    setCells([{ c, p, value }])
    advance(c, p)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, c: number, p: number) {
    const move = (dc: number, dp: number) => {
      e.preventDefault()
      focusCell(Math.min(c + dc, lastCol), p + dp)
    }
    if (e.key === "ArrowRight") move(1, 0)
    else if (e.key === "ArrowLeft") move(-1, 0)
    else if (e.key === "ArrowDown") move(0, 1)
    else if (e.key === "ArrowUp") move(0, -1)
    else if (e.key === "Enter") {
      e.preventDefault()
      if (direction === "round") focusCell(Math.min(c + 1, lastCol), 0)
      else focusCell(0, p + 1)
    } else if (e.key === "Backspace" && columns[c]?.[playerIds[p]] == null) {
      e.preventDefault()
      const prev = previousCell(c, p)
      if (!prev) return
      setCells([{ ...prev, value: null }])
      focusCell(prev.c, prev.p)
    }
  }

  // Pasting a block copied from a spreadsheet fills the grid starting at the focused cell
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, c: number, p: number) {
    const text = e.clipboardData.getData("text")
    const rows = text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) =>
        (line.includes("\t") ? line.split("\t") : line.trim().split(/[,;\s]+/)).map((token) => {
          const value = /^\d+$/.test(token.trim()) ? Number(token.trim()) : null
          return value != null && value >= 1 && value <= maxPosition ? value : null
        })
      )
      .filter((row) => row.some((v) => v != null))
    if (rows.length === 0 || (rows.length === 1 && rows[0].length === 1)) return
    e.preventDefault()

    // Skip leading label cells (player names) so all rows stay aligned
    const offset = Math.min(...rows.map((row) => row.findIndex((v) => v != null)))
    const cells: Array<{ c: number; p: number; value: number }> = []
    rows.slice(0, size - p).forEach((row, i) => {
      row.slice(offset).forEach((value, j) => {
        if (value != null) cells.push({ c: c + j, p: p + i, value })
      })
    })
    setCells(cells)
  }

  function setTimeCells(cells: Array<{ c: number; p: number; text: string }>) {
    setDirty(true)
    setError("")
    setTimes((prev) => {
      const next = { ...prev }
      for (const { c, p, text } of cells) next[`${c}:${playerIds[p]}`] = text
      return next
    })
  }

  function handleTimeKeyDown(e: React.KeyboardEvent<HTMLInputElement>, c: number, p: number) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      focusCell(c, p + (e.key === "ArrowDown" ? 1 : -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const lastRound = lastCol - 1
      if (direction === "round") {
        if (p < size - 1) focusCell(c, p + 1)
        else if (c < lastRound) focusCell(c + 1, 0)
      } else if (c < lastRound) focusCell(c + 1, p)
      else focusCell(0, p + 1)
    }
  }

  function handleTimePaste(e: React.ClipboardEvent<HTMLInputElement>, c: number, p: number) {
    const rows = e.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => (line.includes("\t") ? line.split("\t") : line.trim().split(/[;\s]+/)).map((token) => parseTime(token) ?? null))
      .filter((row) => row.some((v) => v != null))
    if (rows.length === 0 || (rows.length === 1 && rows[0].length === 1)) return
    e.preventDefault()

    const offset = Math.min(...rows.map((row) => row.findIndex((v) => v != null)))
    const cells: Array<{ c: number; p: number; text: string }> = []
    rows.slice(0, size - p).forEach((row, i) => {
      row.slice(offset).forEach((value, j) => {
        if (value != null && c + j < lastCol) cells.push({ c: c + j, p: p + i, text: formatTime(value) })
      })
    })
    setTimeCells(cells)
  }

  async function save() {
    setSaving(true)
    setError("")
    const rounds = columns
      .map((column, c) => ({
        positions: playerIds.map((id) => column[id]),
        times: playerIds.map((id) => parseTime(times[`${c}:${id}`] ?? "") ?? null),
        source: subMatch.rounds[c]?.number ?? null,
      }))
      .filter((_, c) => states[c].kind === "done")
    const res = await fetch(`/b2-stats/api/submatches/${subMatch.id}/rounds`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds, rounds, track }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "Speichern fehlgeschlagen")
      return
    }
    const data = await res.json()
    onSaved(data.rounds)
  }

  return (
    <Dialog open onClose={requestClose} className="max-w-4xl">
      <DialogTitle>
        Runden eintippen
        <span className="ml-2 text-sm font-normal text-[#9a9090]">— {formatLabel(subMatch.format)}</span>
      </DialogTitle>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <p className="text-xs text-[#9a9090] mb-1.5">Map</p>
            <Input value={track} onChange={(e) => { setTrack(e.target.value); setDirty(true) }} placeholder="z.B. Palmotropico" />
          </div>
          <div className="flex-1 min-w-64">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-[#9a9090]">
                Spieler <span className={ready ? "text-[#5e5858]" : "text-[#FBD00D]"}>{playerIds.length}/{size}</span>
              </p>
              {pool.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllPlayers((v) => !v)}
                  className="text-xs text-[#5e5858] hover:text-[#f5f0f0]"
                >
                  {showAllPlayers ? "Nur Lineup" : "Alle Spieler"}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {selectablePlayers.map((player) => {
                const selected = playerIds.includes(player.id)
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player.id)}
                    disabled={!selected && ready}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40",
                      selected
                        ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]"
                        : "border-[#2d2829] text-[#9a9090] hover:border-[#3a3435] hover:text-[#f5f0f0]"
                    )}
                  >
                    {player.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {!ready ? (
          <p className="rounded-lg border border-dashed border-[#2d2829] py-8 text-center text-sm text-[#9a9090]">
            Wähle die {size} Spieler, die diese Map gefahren sind.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="inline-flex rounded-md border border-[#2d2829] p-0.5 text-xs">
                {([
                  ["positions", "Platzierungen", Hash],
                  ["times", "Zeiten", Timer],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-2.5 py-1 transition-colors",
                      mode === value ? "bg-[#FBD00D]/15 text-[#FBD00D]" : "text-[#5e5858] hover:text-[#9a9090]"
                    )}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-md border border-[#2d2829] p-0.5 text-xs">
                {([
                  ["round", "Runde für Runde", ArrowDown],
                  ["player", "Spieler für Spieler", ArrowRight],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDirection(value)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-2.5 py-1 transition-colors",
                      direction === value ? "bg-[#251f20] text-[#f5f0f0]" : "text-[#5e5858] hover:text-[#9a9090]"
                    )}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
              <p className="ml-auto text-sm text-[#9a9090]">
                {done.length} Runde{done.length !== 1 ? "n" : ""}
                <span className="ml-3 font-bold text-[#f5f0f0]">
                  {won}–{lost}{drawn > 0 ? `–${drawn}` : ""}
                </span>
              </p>
            </div>

            <div ref={gridRef} className="overflow-x-auto pb-1">
              <table className="border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#1c1819]" />
                    {columns.map((_, c) => (
                      <th key={c} className="text-[10px] font-medium text-[#5e5858]">R{c + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {playerIds.map((id, p) => (
                    <tr key={id}>
                      <td className="sticky left-0 z-10 bg-[#1c1819] pr-3 text-sm font-medium text-[#f5f0f0] whitespace-nowrap">
                        {playerById.get(id)?.name ?? "?"}
                      </td>
                      {columns.map((column, c) => {
                        const value = column[id]
                        const state = states[c]
                        const duplicate = state.kind === "invalid" && value != null && state.duplicates.has(value)
                        if (mode === "times") {
                          const text = times[`${c}:${id}`] ?? ""
                          const editable = state.kind === "done"
                          return (
                            <td key={c}>
                              <input
                                data-cell={`${c}-${p}`}
                                value={editable ? text : ""}
                                disabled={!editable}
                                placeholder={value != null ? `#${value}` : ""}
                                inputMode="decimal"
                                autoComplete="off"
                                aria-label={`Zeit ${playerById.get(id)?.name ?? "Spieler"}, Runde ${c + 1}`}
                                onChange={(e) => setTimeCells([{ c, p, text: e.target.value }])}
                                onBlur={() => {
                                  const ms = parseTime(text)
                                  if (ms != null && formatTime(ms) !== text) setTimeCells([{ c, p, text: formatTime(ms) }])
                                }}
                                onKeyDown={(e) => handleTimeKeyDown(e, c, p)}
                                onPaste={(e) => handleTimePaste(e, c, p)}
                                onFocus={(e) => e.target.select()}
                                className={cn(
                                  "h-9 w-[5.5rem] rounded-md border bg-[#251f20] px-1 text-center font-mono text-sm text-[#f5f0f0] placeholder:text-[#5e5858] focus:outline-none focus:ring-2 focus:ring-[#FBD00D] disabled:border-dashed disabled:bg-transparent",
                                  editable && parseTime(text) === undefined ? "border-[#ED1F24] text-[#ED1F24]" : "border-[#3a3435]"
                                )}
                              />
                            </td>
                          )
                        }
                        return (
                          <td key={c}>
                            <input
                              data-cell={`${c}-${p}`}
                              value={value ?? ""}
                              inputMode="numeric"
                              autoComplete="off"
                              aria-label={`${playerById.get(id)?.name ?? "Spieler"}, Runde ${c + 1}`}
                              onChange={(e) => handleInput(c, p, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, c, p)}
                              onPaste={(e) => handlePaste(e, c, p)}
                              onFocus={(e) => e.target.select()}
                              className={cn(
                                "h-9 w-9 rounded-md border bg-[#251f20] text-center font-mono text-sm font-bold caret-transparent focus:outline-none focus:ring-2 focus:ring-[#FBD00D]",
                                duplicate
                                  ? "border-[#ED1F24] text-[#ED1F24]"
                                  : cn("border-[#3a3435]", value != null && placementColor(value)),
                                c === lastCol && "border-dashed bg-transparent"
                              )}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="sticky left-0 z-10 bg-[#1c1819] pr-3 text-[10px] uppercase tracking-wider text-[#5e5858]">
                      Punkte
                    </td>
                    {states.map((state, c) => (
                      <td key={c} className="h-9 text-center align-top">
                        {state.kind === "done" && (
                          <>
                            <p className={cn(
                              "text-xs font-bold",
                              state.outcome === "W" ? "text-[#FBD00D]" : state.outcome === "L" ? "text-[#ED1F24]" : "text-[#9a9090]"
                            )}>
                              {state.outcome}
                            </p>
                            <p className="text-[10px] text-[#5e5858]">{state.ours}:{state.theirs}</p>
                          </>
                        )}
                        {state.kind === "incomplete" && <p className="text-xs text-[#5e5858]">…</p>}
                        {state.kind === "invalid" && (
                          <p className="text-xs font-bold text-[#ED1F24]" title="Platzierung doppelt vergeben">!</p>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {mode === "positions" ? (
              <p className="text-xs text-[#5e5858]">
                Platzierung 1–{maxPosition} tippen, der Cursor springt automatisch weiter.
                {maxPosition >= 10 && " 0 steht für Platz 10."} Pfeiltasten navigieren, Enter springt
                {direction === "round" ? " zur nächsten Runde" : " zum nächsten Spieler"}. Kopierte Zeilen aus dem Sheet
                lassen sich direkt einfügen.
              </p>
            ) : (
              <p className="text-xs text-[#5e5858]">
                Zeit als 45.123 oder 1:02.345 eingeben, leer lassen wenn unbekannt. Enter springt zum nächsten Feld.
                Für die Wertung zählt die Platzierung (als # im leeren Feld), Zeiten ändern sie nicht.
              </p>
            )}
          </>
        )}

        {ready && hasInvalidTimes && (
          <p className="text-xs text-[#ED1F24]">Mindestens eine Zeit ist ungültig.</p>
        )}
        {ready && hasProblems && (
          <p className="text-xs text-[#ED1F24]">
            {states.some((s) => s.kind === "invalid")
              ? "Mindestens eine Runde enthält eine doppelte Platzierung."
              : "Mindestens eine Runde ist noch nicht vollständig."}
          </p>
        )}
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={requestClose}>Abbrechen</Button>
          <Button onClick={save} disabled={!canSave}>
            {saving ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
