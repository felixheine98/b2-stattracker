"use client"

import { BASE_PATH } from "@/lib/base-path"
import { INACTIVE_LABEL, AVAILABILITY_LABEL, type Answer, type Availability } from "@/lib/planning"
import type { PlanningMutate } from "@/lib/use-planning-live"
import { cn } from "@/lib/utils"
import { useState } from "react"

export interface LevelRef {
  id: string
  name: string
}

// Colours of the levels, also used for the dots in the lineup variants
export function answerColor(answer: Answer): string {
  if (answer === "FIX") return "border-green-500/40 bg-green-500/15 text-ok"
  if (answer === "MAYBE") return "border-info/40 bg-info/15 text-info"
  if (answer === "OUT") return "border-danger/40 bg-danger/15 text-danger"
  if (answer === "OPEN") return "border-line-strong bg-raised text-fg-muted"
  if (answer === "INACTIVE") return "border-violet/40 bg-violet/15 text-violet"
  // The planning's own extra levels
  return "border-bronze/40 bg-bronze/15 text-bronze"
}

export function answerLabel(answer: Answer, levels: LevelRef[]): string {
  if (answer === "OPEN") return "No answer yet"
  if (answer === "INACTIVE") return INACTIVE_LABEL
  if (answer === "FIX" || answer === "MAYBE" || answer === "OUT") return AVAILABILITY_LABEL[answer]
  return levels.find((l) => `level:${l.id}` === answer)?.name ?? "No answer yet"
}

interface Props {
  tournamentId: string
  playerId: string
  answer: Answer
  // The player does not drive competitions as a rule: taking an answer back leads to "Inactive", not to open
  inactive?: boolean
  // The caller shows "Inactive" next to the player's name, so the answers stay in one line-up
  inactiveNextToName?: boolean
  // undefined: the note is not shown to this viewer
  note?: string | null
  levels: LevelRef[]
  editable: boolean
  // Called once a change is saved, so headings around it can follow without reloading
  onSaved?: (change: { answer?: Answer; note?: string | null }) => void
  // On the live planning page changes go through it, so the list follows at once and stays in step
  mutate?: PlanningMutate
  className?: string
}

const FIXED: Availability[] = ["FIX", "MAYBE"]

// The availability of one player: the levels as buttons, and the note next to them
export function AvailabilityInput({ tournamentId, playerId, answer, inactive, inactiveNextToName, note, levels, editable, onSaved, mutate, className }: Props) {
  // What the user chose here; shown at once and kept, the page is not reloaded for it
  const [pending, setPending] = useState<Answer | null>(null)
  const [noteText, setNoteText] = useState(note ?? "")
  const [savedNote, setSavedNote] = useState(note ?? "")
  // What is stored changed (someone else, or the own change came back): show that
  const [seen, setSeen] = useState({ answer, note })
  if (seen.answer !== answer || seen.note !== note) {
    setSeen({ answer, note })
    setPending(null)
    if (seen.note !== note) {
      setNoteText(note ?? "")
      setSavedNote(note ?? "")
    }
  }
  const [error, setError] = useState("")
  const shown = pending ?? answer

  // shownAnswer: what the list shows for the saved answer (an answer taken back is stored as "OPEN")
  async function save(body: { answer?: Answer; note?: string }, shownAnswer?: Answer) {
    const listed = shownAnswer ?? body.answer ?? answer
    setError("")
    const request = () =>
      fetch(`${BASE_PATH}/api/tournaments/${tournamentId}/planning/entries/${playerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null)
    let failed: string | null
    if (mutate) {
      const change = body.note !== undefined ? { note: body.note || null } : { answer: listed }
      failed = await mutate((s) => ({ ...s, rows: s.rows.map((r) => (r.player.id === playerId ? { ...r, ...change } : r)) }), request)
    } else {
      const res = await request()
      failed = res?.ok ? null : (((await res?.json().catch(() => null))?.error as string | undefined) ?? "Failed to save")
    }
    if (failed) {
      setError(failed)
      setPending(null)
      return
    }
    if (body.note !== undefined) setSavedNote(body.note)
    onSaved?.(body.note !== undefined ? { note: body.note || null } : { answer: listed })
  }

  function choose(next: Answer) {
    // A second click on the chosen level takes the answer back
    const takenBack = next === shown
    const value = takenBack ? (inactive ? "INACTIVE" : "OPEN") : next
    setPending(value)
    save({ answer: takenBack ? "OPEN" : next }, value)
  }

  const options: Array<{ value: Answer; label: string }> = [
    ...FIXED.map((v) => ({ value: v as Answer, label: AVAILABILITY_LABEL[v] })),
    ...levels.map((l) => ({ value: `level:${l.id}` as Answer, label: l.name })),
    { value: "OUT", label: AVAILABILITY_LABEL.OUT },
  ]

  return (
    <div className={cn("flex min-w-0 flex-col gap-2 md:flex-row md:items-center", className)}>
      <div className="flex flex-wrap gap-1.5">
        {editable ? (
          options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={shown === o.value}
              onClick={() => choose(o.value)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                shown === o.value ? answerColor(o.value) : "border-line text-fg-subtle hover:border-line-strong hover:text-fg-muted"
              )}
            >
              {o.label}
            </button>
          ))
        ) : (
          // "Inactive" is not repeated here where the list already says it next to the name
          !(inactiveNextToName && shown === "INACTIVE") && (
            <span className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium", answerColor(shown))}>
              {answerLabel(shown, levels)}
            </span>
          )
        )}
      </div>
      {note !== undefined &&
        (editable ? (
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={() => { if (noteText.trim() !== savedNote) save({ note: noteText.trim() }) }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
            maxLength={300}
            placeholder="Note (e.g. only from match day 2)"
            aria-label="Note"
            className="h-8 min-w-0 flex-1 rounded-md border border-dashed border-line bg-transparent px-2.5 text-xs text-fg-soft placeholder:text-fg-subtle focus:border-solid focus:border-brand focus:outline-none"
          />
        ) : (
          note && <span className="min-w-0 flex-1 text-xs text-fg-muted">{note}</span>
        ))}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
