"use client"

import { PlayerAvatar } from "@/components/player-avatar"
import { BASE_PATH } from "@/lib/base-path"
import { countryName, countryOptions } from "@/lib/countries"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useEffect, useState } from "react"

interface Props {
  player: { name: string; country?: string | null }
  onChange: (country: string | null) => void
}

// The player's flag as a button: it opens the flags to choose from, plus "no country"
export function CountryFlagPicker({ player, onChange }: Props) {
  // Placed relative to the window, so no surrounding box can cut the menu off
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!at) return
    const close = () => setAt(null)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [at])

  function pick(country: string | null) {
    setAt(null)
    if (country !== (player.country ?? null)) onChange(country)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          setAt(at ? null : { x: box.left, y: box.bottom + 6 })
        }}
        aria-haspopup="menu"
        aria-expanded={!!at}
        aria-label={`Change country of ${player.name}`}
        title={player.country ? `${countryName(player.country)} · change` : "Pick a country"}
        className="shrink-0 rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <PlayerAvatar player={player} />
      </button>
      {at && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAt(null)} />
          <div
            role="menu"
            style={{ left: at.x, top: at.y }}
            className="fixed z-50 flex gap-1.5 rounded-lg border border-line-strong bg-surface p-1.5 shadow-xl"
          >
            {countryOptions(player.country).map((c) => (
              <button
                key={c.code}
                type="button"
                role="menuitemradio"
                aria-checked={c.code === player.country}
                onClick={() => pick(c.code)}
                title={c.name}
                aria-label={c.name}
                className={cn("rounded-full p-0.5 hover:bg-line-strong", c.code === player.country && "ring-2 ring-brand")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${BASE_PATH}/flags/${c.code}.svg`} alt="" className="h-7 w-7 rounded-full object-cover" />
              </button>
            ))}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!player.country}
              onClick={() => pick(null)}
              title="No country"
              aria-label="No country"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-fg-muted hover:bg-line-strong hover:text-fg",
                !player.country && "ring-2 ring-brand"
              )}
            >
              <X size={15} />
            </button>
          </div>
        </>
      )}
    </>
  )
}
