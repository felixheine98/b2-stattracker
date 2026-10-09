"use client"

import { GuestBadge } from "@/components/guest-badge"
import { Input } from "@/components/ui/input"
import { searchPlayers } from "@/lib/player-search"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import { useState } from "react"

interface Props {
  // Players that can still be picked
  players: Array<{ id: string; name: string; tmId: string }>
  isGuest: (tmId: string) => boolean
  onPick: (id: string) => void
}

// Type a name, move through the suggestions with the arrow keys and pick one with Enter
export function PlayerSearch({ players, isGuest, onPick }: Props) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const matches = searchPlayers(players, query).slice(0, 8)

  function pick(id: string) {
    onPick(id)
    setQuery("")
    setActive(0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (matches.length > 0) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (matches[active]) pick(matches[active].id)
    } else if (e.key === "Escape" && query) {
      e.stopPropagation()
      setQuery("")
    }
  }

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e5858]" />
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0) }}
        onKeyDown={handleKeyDown}
        placeholder="Spieler suchen, Enter wählt aus"
        autoComplete="off"
        aria-label="Spieler suchen"
        className="pl-9"
      />
      {query.trim() && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-[#3a3435] bg-[#1c1819] p-1 shadow-lg">
          {matches.length === 0 && <p className="px-2.5 py-1.5 text-xs text-[#5e5858]">Kein freier Spieler gefunden.</p>}
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              // Keep the focus in the search field so typing can go on
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-[#f5f0f0]",
                i === active && "bg-[#FBD00D]/10"
              )}
            >
              {p.name}
              {isGuest(p.tmId) && <GuestBadge />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
