"use client"

import { createContext, useContext, type ReactNode } from "react"
import { isOwnPlayer, type OwnPlayer } from "@/lib/own-player"

// The signed-in account's player for every page of the dashboard, so its stats rows stand out
const OwnPlayerContext = createContext<OwnPlayer | null>(null)

export function OwnPlayerProvider({ player, children }: { player: OwnPlayer | null; children: ReactNode }) {
  return <OwnPlayerContext.Provider value={player}>{children}</OwnPlayerContext.Provider>
}

// The class for a table row or card of the own player (`own-row` in globals.css), otherwise ""
export function useOwnRow() {
  const own = useContext(OwnPlayerContext)
  return (row: { id?: string | null; playerId?: string | null; tmId?: string | null }) => (isOwnPlayer(own, row) ? "own-row" : "")
}

// "You" beside a name outside a table, e.g. the best performer on the dashboard
export function OwnTag({ tmId }: { tmId: string }) {
  const own = useContext(OwnPlayerContext)
  if (!isOwnPlayer(own, { tmId })) return null
  return <span className="ml-1.5 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">You</span>
}
