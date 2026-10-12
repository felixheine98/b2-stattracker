"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { useState } from "react"

interface Props {
  options: Array<{ id: string; label: string }>
  // Nothing selected means all
  selected: string[]
  onChange: (ids: string[]) => void
  className?: string
}

// "All" plus one button per option. A click shows only that option; with "Multiple" switched on,
// clicks add or remove options instead, and with none left it is "All" again.
export function PillSelect({ options, selected, onChange, className }: Props) {
  // A selection of several options (e.g. from a shared link) only makes sense in multi mode
  const [multiChosen, setMultiChosen] = useState(false)
  const multi = multiChosen || selected.length > 1

  function toggle(id: string) {
    if (!multi) onChange(selected.includes(id) ? [] : [id])
    else onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  function setMulti(on: boolean) {
    setMultiChosen(on)
    if (!on && selected.length > 1) onChange(selected.slice(0, 1))
  }

  const pill = (active: boolean) =>
    cn(
      "whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors",
      active ? "bg-brand/15 text-brand-ink" : "text-fg-muted hover:text-fg"
    )
  return (
    <div className={cn("flex max-w-full flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
        <button type="button" aria-pressed={selected.length === 0} onClick={() => onChange([])} className={pill(selected.length === 0)}>
          All
        </button>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={selected.includes(o.id)} onClick={() => toggle(o.id)} className={pill(selected.includes(o.id))}>
            {o.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={multi}
        onClick={() => setMulti(!multi)}
        className={cn("inline-flex items-center gap-1.5 text-xs transition-colors", multi ? "text-fg-soft" : "text-fg-subtle hover:text-fg-muted")}
      >
        <span
          className={cn(
            "flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border",
            multi ? "border-brand bg-brand text-brand-fg" : "border-fg-subtle"
          )}
        >
          {multi && <Check size={10} strokeWidth={3.5} />}
        </span>
        Multiple
      </button>
    </div>
  )
}
