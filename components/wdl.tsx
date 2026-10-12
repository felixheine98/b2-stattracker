"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"

interface Props {
  won: number
  drawn: number
  lost: number
  // What is counted, e.g. "Rounds"
  unit: string
  className?: string
}

// A result as won–drawn–lost (draws left out when there are none); hovering spells it out
export function Wdl({ won, drawn, lost, unit, className }: Props) {
  // Placed relative to the window, so no surrounding box can cut the tooltip off
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <span
      className={cn("cursor-help", className)}
      onMouseEnter={(e) => {
        const box = e.currentTarget.getBoundingClientRect()
        setAt({ x: box.left + box.width / 2, y: box.bottom + 6 })
      }}
      onMouseLeave={() => setAt(null)}
    >
      {won}–{drawn > 0 ? `${drawn}–` : ""}{lost}
      {at && (
        <span
          role="tooltip"
          style={{ left: at.x, top: at.y }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-strong bg-raised px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-fg-soft shadow-lg"
        >
          {unit}: <span className="text-brand-ink">{won} won</span> · {drawn} drawn ·{" "}
          <span className="text-danger">{lost} lost</span>
        </span>
      )}
    </span>
  )
}
