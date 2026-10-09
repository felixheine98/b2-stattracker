"use client"

import { PillSelect } from "@/components/pill-select"
import { cn } from "@/lib/utils"
import { SlidersHorizontal, X } from "lucide-react"
import { useState } from "react"

interface Group {
  label: string
  options: Array<{ id: string; label: string }>
  // Nothing selected means all
  selected: string[]
  onChange: (ids: string[]) => void
}

// The filters above a stats section. From 768px one bar per group; on phones a single
// "Filter" button that opens all groups in a sheet, with the active filters shown next to it.
export function StatsFilter({ groups, className }: { groups: Group[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const active = groups.flatMap((g) => g.options.filter((o) => g.selected.includes(o.id)).map((o) => ({ group: g, option: o })))

  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3.5 py-2 text-sm transition-colors",
      on ? "border-[#FBD00D]/40 bg-[#FBD00D]/15 text-[#FBD00D]" : "border-[#2d2829] text-[#9a9090]"
    )

  return (
    <div className={className}>
      <div className="hidden flex-wrap gap-2 md:flex">
        {groups.map((g) => (
          <PillSelect key={g.label} options={g.options} selected={g.selected} onChange={g.onChange} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#3a3435] px-3 py-2 text-sm text-[#f5f0f0]"
        >
          <SlidersHorizontal size={14} />
          Filter
          {active.length > 0 && (
            <span className="rounded-full bg-[#FBD00D] px-1.5 text-[11px] font-bold leading-4 text-[#1a1718]">{active.length}</span>
          )}
        </button>
        {active.map(({ group, option }) => (
          <button
            key={`${group.label}-${option.id}`}
            type="button"
            onClick={() => group.onChange(group.selected.filter((id) => id !== option.id))}
            aria-label={`${option.label} entfernen`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FBD00D]/15 py-1.5 pl-3 pr-2 text-xs text-[#FBD00D]"
          >
            {option.label}
            <X size={12} />
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-9999 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-[#3a3435] bg-[#1c1819] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {groups.map((g) => (
              <div key={g.label} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">{g.label}</h3>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={g.selected.length === 0} onClick={() => g.onChange([])} className={chip(g.selected.length === 0)}>
                    Alle
                  </button>
                  {/* In the sheet every tap adds or removes an option */}
                  {g.options.map((o) => {
                    const on = g.selected.includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => g.onChange(on ? g.selected.filter((id) => id !== o.id) : [...g.selected, o.id])}
                        className={chip(on)}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-lg bg-[#FBD00D] py-3 text-sm font-bold text-[#1a1718]">
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
