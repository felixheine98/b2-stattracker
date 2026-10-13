"use client"

import { PillSelect } from "@/components/pill-select"
import { cn } from "@/lib/utils"
import { SlidersHorizontal, X } from "lucide-react"
import { Fragment, useState } from "react"

interface Group {
  label: string
  options: Array<{ id: string; label: string }>
  // Nothing selected means all
  selected: string[]
  onChange: (ids: string[]) => void
  // From 768px on this group has a row to itself, the next ones start below it
  ownRow?: boolean
}

// The filters above a stats section. From 768px one bar per group; on phones a single
// "Filter" button that opens all groups in a sheet, with the active filters shown next to it.
export function StatsFilter({ groups, className }: { groups: Group[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const active = groups.flatMap((g) => g.options.filter((o) => g.selected.includes(o.id)).map((o) => ({ group: g, option: o })))

  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3.5 py-2 text-sm transition-colors",
      on ? "border-brand/40 bg-brand/15 text-brand-ink" : "border-line text-fg-muted"
    )

  return (
    <div className={className}>
      <div className="hidden flex-wrap gap-2 md:flex">
        {groups.map((g) => (
          <Fragment key={g.label}>
            <PillSelect options={g.options} selected={g.selected} onChange={g.onChange} />
            {g.ownRow && <div className="basis-full" />}
          </Fragment>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm text-fg"
        >
          <SlidersHorizontal size={14} />
          Filter
          {active.length > 0 && (
            <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold leading-4 text-brand-fg">{active.length}</span>
          )}
        </button>
        {active.map(({ group, option }) => (
          <button
            key={`${group.label}-${option.id}`}
            type="button"
            onClick={() => group.onChange(group.selected.filter((id) => id !== option.id))}
            aria-label={`Remove ${option.label}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand/15 py-1.5 pl-3 pr-2 text-xs text-brand-ink"
          >
            {option.label}
            <X size={12} />
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-9999 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-line-strong bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {groups.map((g) => (
              <div key={g.label} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{g.label}</h3>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={g.selected.length === 0} onClick={() => g.onChange([])} className={chip(g.selected.length === 0)}>
                    All
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
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-lg bg-brand py-3 text-sm font-bold text-brand-fg">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
