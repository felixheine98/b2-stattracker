"use client"

import { useId, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { searchPlayers } from "@/lib/player-search"
import { cn } from "@/lib/utils"

interface Option { value: string; label: string; hint?: string }

interface Props {
  value: string
  onChange: (value: string) => void
  players: Array<{ id: string; name: string; allNames?: string[]; hint?: string }>
  // Fixed choices above the players, e.g. "Not a player"; their value must not be a player id
  extra?: Option[]
  placeholder?: string
  disabled?: boolean
  "aria-label"?: string
  className?: string
}

// A select you can type into: typing filters the players (also by former names), the arrow opens the
// whole list, arrow keys move and Enter picks. Leaving the field without a pick keeps the old value.
export function PlayerCombobox({ value, onChange, players, extra = [], placeholder = "Choose player…", disabled, className, ...props }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const all: Option[] = [...extra, ...players.map(p => ({ value: p.id, label: p.name, hint: p.hint }))]
  const selected = all.find(o => o.value === value)
  const options: Option[] = query.trim()
    ? searchPlayers(players, query).map(p => ({ value: p.id, label: p.name, hint: p.hint }))
    : all

  function show() { setOpen(true); setQuery(""); setActive(Math.max(0, all.findIndex(o => o.value === value))) }
  function pick(option: Option) { onChange(option.value); setOpen(false); setQuery(""); input.current?.blur() }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { e.preventDefault(); show(); return }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (options.length > 0) setActive(i => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (options[active]) pick(options[active])
    } else if (e.key === "Escape" && open) {
      e.stopPropagation()
      setOpen(false); setQuery("")
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={props["aria-label"]}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selected?.label ?? ""}
        placeholder={open ? selected?.label ?? placeholder : placeholder}
        onFocus={show}
        onClick={() => { if (!open) show() }}
        onBlur={() => { setOpen(false); setQuery("") }}
        onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true) }}
        onKeyDown={handleKeyDown}
        className="flex h-9 w-full rounded-md border border-line-strong bg-raised py-1 pl-3 pr-8 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button type="button" tabIndex={-1} aria-label="Show all players" disabled={disabled}
        onMouseDown={e => { e.preventDefault(); if (open) setOpen(false); else input.current?.focus() }}
        className="absolute right-0 top-0 flex h-9 w-8 items-center justify-center text-fg-subtle hover:text-fg disabled:opacity-50">
        <ChevronDown size={14} />
      </button>
      {open && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line-strong bg-surface p-1 shadow-lg">
          {options.length === 0 && <p className="px-2.5 py-1.5 text-xs text-fg-subtle">No player found.</p>}
          {options.map((o, i) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              // Keep the focus in the field until the pick is made
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(o)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-fg",
                i === active && "bg-brand/10", o.value === value && "font-medium")}>
              <span className="truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-fg-subtle">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
