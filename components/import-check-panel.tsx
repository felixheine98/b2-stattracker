"use client"

import { formatDay } from "@/lib/player-status"
import type { useImportCheck } from "@/lib/use-import-check"
import { ClipboardList, TriangleAlert } from "lucide-react"

// What the preview of an import shows about its match: the hints that have to be confirmed
// and the offer to take the day of the rounds over (see lib/import-check.ts), and where it was
// driven otherwise than planned, which is only shown (docs/adr/008)
export function ImportCheckPanel({ check }: { check: ReturnType<typeof useImportCheck> }) {
  if (check.loading) return <p className="text-xs text-fg-subtle">Checking the import against the match…</p>
  if (check.failed) return <p className="text-xs text-fg-subtle">The import could not be checked against the match.</p>
  if (!check.dateOffer && check.hints.length === 0 && check.planDeviations.length === 0) return null
  return (
    <div className="space-y-3">
      {check.planDeviations.length > 0 && (
        <div className="space-y-1 rounded-lg border border-line bg-canvas px-3 py-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
            <ClipboardList size={14} className="shrink-0 text-info" />
            Driven otherwise than planned
          </p>
          <ul className="space-y-0.5 text-sm text-fg-soft">
            {check.planDeviations.map((line) => (
              <li key={line} className="break-words">{line}</li>
            ))}
          </ul>
        </div>
      )}
      {check.dateOffer && (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg-soft">
          <input type="checkbox" checked={check.takeDate} onChange={(e) => check.setTakeDate(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand" />
          <span className="min-w-0">
            Set the date of the match to {formatDay(check.dateOffer.importDay)}, the day the rounds were driven
            {check.dateOffer.matchDay ? ` (now ${formatDay(check.dateOffer.matchDay)})` : " (the match has no date yet)"}.
          </span>
        </label>
      )}
      {check.hints.length > 0 && (
        <div className="space-y-2 rounded-lg border border-bronze/50 bg-bronze/10 px-3 py-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-bronze">
            <TriangleAlert size={14} className="shrink-0" />
            This import does not fit the match in every respect
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-fg-soft">
            {check.hints.map((hint) => (
              <li key={hint.short} className="break-words">{hint.text}</li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-fg">
            <input type="checkbox" checked={check.confirmed} onChange={(e) => check.setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand" />
            <span>Import anyway. This is noted on the match.</span>
          </label>
        </div>
      )}
    </div>
  )
}
