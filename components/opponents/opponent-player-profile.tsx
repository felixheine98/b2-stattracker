"use client"
import { useState } from "react"
import Link from "next/link"
import { confirmedTmId, type opponentStats } from "@/lib/opponents"
import { Button } from "@/components/ui/button"
import { OpponentStatistics } from "./opponent-statistics"
import { OpponentHistory } from "./opponent-history"
import { IdentityDialog } from "./identity-dialog"
import type { OpponentPlayer, HistoryMatch } from "./types"
export function OpponentPlayerProfile({ player, matches, stats, canAssign }: { player: OpponentPlayer; matches: HistoryMatch[]; stats: ReturnType<typeof opponentStats>; canAssign: boolean }) {
  const [assign, setAssign] = useState(false)
  return <div className="page-wide space-y-6"><Link href="/opponents" className="text-sm text-fg-muted">← Opponents</Link><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="break-words text-2xl font-bold">{player.name}</h1><p className="mt-1 text-sm text-fg-muted">{player.isOpponentOnly ? "Opponent profile" : "Player profile · rounds against us"}{player.country && ` · ${player.country.toUpperCase()}`}</p>{confirmedTmId(player.tmId) ? <a href={`https://trackmania.io/#/player/${player.tmId}`} target="_blank" rel="noreferrer" className="text-sm text-brand-ink">Trackmania.io profile ↗</a> : <p className="mt-2 text-sm text-fg-muted">Identity not confirmed yet.</p>}</div>{canAssign && <Button variant="outline" onClick={() => setAssign(true)}>Assign appearances via TM.io</Button>}</div><OpponentStatistics stats={stats} hideBalance /><OpponentHistory matches={matches} />{assign && <IdentityDialog name={player.name} onClose={() => setAssign(false)} />}</div>
}
