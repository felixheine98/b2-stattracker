"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"

interface Props {
  options: Array<{ id: string; label: string }>
  // Nothing selected means all
  selected: string[]
  onChange: (ids: string[]) => void
  className?: string
}

// "Alle" plus one button per option. A click shows only that option; with "Mehrfach" ticked,
// clicks add or remove options instead, and with none left it is "Alle" again.
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
      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
      active ? "bg-[#FBD00D]/15 text-[#FBD00D]" : "text-[#9a9090] hover:text-[#f5f0f0]"
    )
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1 rounded-lg border border-[#2d2829] bg-[#1c1819] p-1", className)}>
      <button type="button" aria-pressed={selected.length === 0} onClick={() => onChange([])} className={pill(selected.length === 0)}>
        Alle
      </button>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={selected.includes(o.id)} onClick={() => toggle(o.id)} className={pill(selected.includes(o.id))}>
          {o.label}
        </button>
      ))}
      <label className="ml-1 flex cursor-pointer items-center gap-1.5 border-l border-[#2d2829] px-2 text-xs text-[#5e5858] hover:text-[#9a9090]">
        <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="accent-[#FBD00D]" />
        Mehrfach
      </label>
    </div>
  )
}
