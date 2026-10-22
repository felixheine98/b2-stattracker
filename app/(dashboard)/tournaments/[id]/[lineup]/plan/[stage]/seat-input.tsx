"use client"

import { useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { PlayerAvatar } from "@/components/player-avatar"
import { cn } from "@/lib/utils"

export interface SeatPlayer {
  id: string
  name: string
  country: string | null
}

interface Props {
  label: string
  player: SeatPlayer | null
  // The players offered for the typed text, best first
  suggest: (query: string) => SeatPlayer[]
  // The colour of the dot showing a player's answer
  dot: (playerId: string) => string
  // Out, or not there for the match
  warn?: boolean
  disabled?: boolean
  onPick: (playerId: string) => void
  onClear: () => void
}

// One place of a lineup: the player's name is typed in, with suggestions from the kader while typing.
// Enter or a click takes a suggestion; a name typed in full counts when the field is left.
export function SeatInput({ label, player, suggest, dot, warn, disabled, onPick, onClear }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const open = text !== null
  const options = open ? suggest(text).slice(0, 8) : []

  function pick(id: string) {
    setText(null)
    if (id !== player?.id) onPick(id)
  }

  function leave() {
    if (text === null) return
    const typed = text.trim().toLowerCase()
    const exact = options.find((p) => p.name.toLowerCase() === typed)
    if (exact) pick(exact.id)
    else if (!typed && player) {
      setText(null)
      onClear()
    } else setText(null)
  }

  return (
    <div className="relative min-w-0">
      <div
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-lg border bg-raised px-2 text-sm transition-colors focus-within:border-brand",
          player ? "border-line" : "border-dashed border-line-strong",
          warn && "border-danger/60 text-danger"
        )}
      >
        {player && !open && <PlayerAvatar player={player} className="h-4 w-4 text-[9px]" />}
        <input
          aria-label={label}
          aria-autocomplete="list"
          value={text ?? player?.name ?? ""}
          placeholder="open"
          disabled={disabled}
          onFocus={(e) => {
            setText(player?.name ?? "")
            setActive(0)
            e.target.select()
          }}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
          }}
          onBlur={leave}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, options.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              if (options[active]) pick(options[active].id)
              else leave()
              e.currentTarget.blur()
            } else if (e.key === "Escape") {
              setText(null)
              e.currentTarget.blur()
            }
          }}
          className={cn("h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-subtle", warn ? "text-danger" : "text-fg")}
        />
        {player && !open && warn && <AlertTriangle size={12} className="shrink-0" />}
        {player && !open && (
          <button
            type="button"
            aria-label={`Remove ${player.name}`}
            disabled={disabled}
            onClick={onClear}
            className="-mr-1 shrink-0 rounded p-1 text-fg-subtle hover:text-danger"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute left-0 top-full z-20 mt-1 max-h-64 w-max min-w-full max-w-64 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {options.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              // Before the field loses focus, so the click is not lost
              onMouseDown={(e) => {
                e.preventDefault()
                pick(p.id)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm text-fg", i === active && "bg-brand/15")}
            >
              <PlayerAvatar player={p} className="h-4 w-4 text-[9px]" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", dot(p.id))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
