"use client"

import { BASE_PATH } from "./base-path"
import { dateHint, type DateCheck, type ImportHint, type ImportSides } from "./import-check"
import { useEffect, useState } from "react"

interface Loaded {
  key: string
  hints: ImportHint[]
  date: DateCheck | null
  failed?: boolean
}

// The check of an import against its match, for the preview of an import dialog (see
// lib/import-check.ts). sides is what the dialog would save, null while there is nothing to
// import. The server is asked anew whenever the sides change; a hint has to be confirmed
// before saving, and a new set of hints asks for it again.
export function useImportCheck(tournamentId: string, matchId: string, sides: ImportSides | null) {
  const key = sides ? JSON.stringify(sides) : ""
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null)
  // null: as offered (taken over for a match without a date, not for one whose date differs)
  const [dateChoice, setDateChoice] = useState<boolean | null>(null)

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    // Moving drivers or ticking rounds changes the sides several times in a row
    const timer = setTimeout(async () => {
      const res = await fetch(`${BASE_PATH}/api/tournaments/${tournamentId}/matches/${matchId}/import/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: key,
        signal: controller.signal,
      }).catch(() => null)
      if (controller.signal.aborted) return
      const data = res?.ok ? await res.json().catch(() => null) : null
      // A check that cannot be loaded does not stand in the way of the import
      setLoaded(data ? { key, hints: data.hints, date: data.date } : { key, hints: [], date: null, failed: true })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, tournamentId, matchId])

  const current = key && loaded?.key === key ? loaded : null
  const date = current?.date ?? null
  // The day of the import is on offer when the match has none or another one
  const dateOffer = date && (date.matchDay === null || date.differs) ? date : null
  const takeDate = !!dateOffer && (dateChoice ?? dateOffer.matchDay === null)
  const hints = [
    ...(current?.hints ?? []),
    ...(dateOffer?.matchDay && !takeDate ? [dateHint({ importDay: dateOffer.importDay, matchDay: dateOffer.matchDay })] : []),
  ]
  const signature = hints.map((h) => h.short).join("\n")
  const confirmed = hints.length === 0 || confirmedFor === signature

  return {
    loading: !!key && !current,
    failed: !!current?.failed,
    hints,
    dateOffer,
    takeDate,
    setTakeDate: setDateChoice,
    confirmed,
    setConfirmed: (on: boolean) => setConfirmedFor(on ? signature : null),
    // Saving waits for the check and for the confirmation of its hints
    ready: !!current && confirmed,
    // What goes along with the rounds when saving
    warnings: hints.map((h) => h.short),
    date: takeDate ? dateOffer!.importDay : undefined,
  }
}
