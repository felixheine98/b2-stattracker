"use client"

import { GuestBadge } from "@/components/guest-badge"
import { PlayerAvatar } from "@/components/player-avatar"
import { useSyncedState } from "@/lib/use-synced-state"
import { formatDay, localTodayKey } from "@/lib/player-status"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Swords, Users, ChevronRight, Calendar, BarChart2, Plus, Trash2 } from "lucide-react"
import { formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface RoundResult {
  id: string
  tmId: string
  playerName: string
  timeMs: number | null
  isOurTeam: boolean
  playerId?: string | null
}

interface Round {
  id: string
  number: number
  results: RoundResult[]
}

interface SubMatch {
  id: string
  format: Format
  order: number
  rounds: Round[]
}

interface Match {
  id: string
  isSeeding: boolean
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  _count: { subMatches: number }
  subMatches: SubMatch[]
}

interface Player {
  id: string
  name: string
  tmId: string
  country?: string | null
}

interface Props {
  lineup: {
    id: string
    name: string
    tournament: { id: string; name: string; formats: Format[] }
    slots: Array<{ id: string; player: Player }>
    matches: Match[]
  }
  // Lower-cased TM IDs of players who are guests in this tournament
  guestTmIds: string[]
  canManage: boolean
}

// Points-based round outcome
function roundOutcome(results: RoundResult[]): "W" | "L" | "D" | null {
  const n = results.length
  if (n === 0) return null
  const ours = results.filter((r) => r.isOurTeam)
  const theirs = results.filter((r) => !r.isOurTeam)
  if (ours.length === 0 || theirs.length === 0) return null
  const rank = new Map(results.map((r, i) => [r.id, i + 1]))
  const pts = ours.reduce((s, r) => s + (n - (rank.get(r.id) ?? n) + 1), 0)
  const total = (n * (n + 1)) / 2
  return pts * 2 > total ? "W" : pts * 2 < total ? "L" : "D"
}

type FormatAggregate = {
  format: Format
  teamRoundsWon: number
  teamRoundsLost: number
  mapWon: number
  mapLost: number
  mapDrawn: number
  // keyed by tmId
  players: Map<string, { tmId: string; name: string; roundsPlayed: number; placementSum: number }>
}

function buildAggregates(matches: Match[]): FormatAggregate[] {
  const byFormat = new Map<Format, FormatAggregate>()

  for (const match of matches) {
    for (const sm of match.subMatches) {
      if (!byFormat.has(sm.format)) {
        byFormat.set(sm.format, {
          format: sm.format,
          teamRoundsWon: 0, teamRoundsLost: 0,
          mapWon: 0, mapLost: 0, mapDrawn: 0,
          players: new Map(),
        })
      }
      const agg = byFormat.get(sm.format)!
      let smWon = 0, smLost = 0

      for (const round of sm.rounds) {
        const o = roundOutcome(round.results)
        if (o === "W") { agg.teamRoundsWon++; smWon++ }
        else if (o === "L") { agg.teamRoundsLost++; smLost++ }

        round.results.forEach((r, idx) => {
          if (!r.isOurTeam) return
          if (!agg.players.has(r.tmId)) {
            agg.players.set(r.tmId, { tmId: r.tmId, name: r.playerName, roundsPlayed: 0, placementSum: 0 })
          }
          const p = agg.players.get(r.tmId)!
          p.roundsPlayed++
          p.placementSum += idx + 1 // results already sorted by timeMs asc
        })
      }

      if (sm.rounds.length > 0 && (smWon + smLost) > 0) {
        if (smWon > smLost) agg.mapWon++
        else if (smLost > smWon) agg.mapLost++
        else agg.mapDrawn++
      }
    }
  }

  // Only return formats with actual data, ordered sensibly
  const order: Format[] = ["TIME_ATTACK_10", "ROUND_1V1", "ROUND_2V2", "ROUND_3V3", "ROUND_4V4", "ROUND_5V5"]
  return order
    .filter((f) => byFormat.has(f) && byFormat.get(f)!.players.size > 0)
    .map((f) => byFormat.get(f)!)
}

function FormatStatsTable({ agg, isGuest }: { agg: FormatAggregate; isGuest: (tmId: string) => boolean }) {
  const players = Array.from(agg.players.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={agg.format === "TIME_ATTACK_10" ? "primary" : "secondary"}>
          {formatLabel(agg.format)}
        </Badge>
        <span className="text-xs text-[#5e5858]">
          Map: {agg.mapWon}W – {agg.mapLost}L{agg.mapDrawn > 0 ? ` – ${agg.mapDrawn}D` : ""}
          &nbsp;·&nbsp;Rounds: {agg.teamRoundsWon}W – {agg.teamRoundsLost}L
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#2d2829]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2d2829] bg-[#1c1819]">
              <th className="text-left py-2 pl-3 pr-4 font-medium text-[#5e5858] whitespace-nowrap">Spieler</th>
              <th className="text-right py-2 px-3 font-medium text-[#5e5858] whitespace-nowrap">Gespielt</th>
              <th className="text-right py-2 px-3 font-medium text-[#5e5858] whitespace-nowrap">Platzsumme</th>
              <th className="text-right py-2 px-3 font-medium text-[#5e5858] whitespace-nowrap">Ø Platz</th>
              <th className="text-right py-2 px-3 font-medium text-[#5e5858] whitespace-nowrap">Round W</th>
              <th className="text-right py-2 pr-3 font-medium text-[#5e5858] whitespace-nowrap">Round L</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.tmId} className="border-b border-[#1c1819] hover:bg-[#1c1819]/60">
                <td className="py-1.5 pl-3 pr-4 text-[#f5f0f0] font-medium whitespace-nowrap">
                  {p.name}
                  {isGuest(p.tmId) && <GuestBadge className="ml-1.5" />}
                </td>
                <td className="py-1.5 px-3 text-right text-[#c5bfbf]">{p.roundsPlayed}</td>
                <td className="py-1.5 px-3 text-right text-[#c5bfbf]">{p.placementSum}</td>
                <td className="py-1.5 px-3 text-right text-[#c5bfbf] font-mono">
                  {p.roundsPlayed > 0 ? (p.placementSum / p.roundsPlayed).toFixed(3) : "—"}
                </td>
                <td className="py-1.5 px-3 text-right text-[#f5f0f0]">{agg.teamRoundsWon}</td>
                <td className="py-1.5 pr-3 text-right text-[#f5f0f0]">{agg.teamRoundsLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function LineupMatchesView({ lineup, guestTmIds, canManage }: Props) {
  const guests = new Set(guestTmIds)
  const isGuest = (tmId: string) => guests.has(tmId.toLowerCase())
  const router = useRouter()
  const { tournament } = lineup
  const [matches, setMatches] = useSyncedState(lineup.matches)
  const aggregates = buildAggregates(matches)
  const nonSeedingFormats = tournament.formats.filter((f) => f !== "TIME_ATTACK_10")

  // --- Add match dialog state ---
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [matchError, setMatchError] = useState("")
  const [matchLoading, setMatchLoading] = useState(false)
  const [deletingMatch, setDeletingMatch] = useState<string | null>(null)

  function openAddMatch() {
    setIsSeeding(false)
    setMatchError("")
    setShowAddMatch(true)
  }

  // New matches always belong to this lineup
  async function handleCreateMatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMatchError("")
    setMatchLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch(`/b2-stats/api/tournaments/${tournament.id}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isSeeding,
        opponent: form.get("opponent") || null,
        date: form.get("date") || null,
        notes: form.get("notes") || null,
        lineupId: lineup.id,
      }),
    })
    setMatchLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setMatchError(data?.error ?? "Failed to create match")
      return
    }
    const data = await res.json()
    setShowAddMatch(false)
    router.push(`/tournaments/${tournament.id}/matches/${data.id}`)
  }

  async function handleDeleteMatch(matchId: string) {
    if (!confirm("Delete this match and all its data?")) return
    setDeletingMatch(matchId)
    const res = await fetch(`/b2-stats/api/tournaments/${tournament.id}/matches/${matchId}`, { method: "DELETE" })
    setDeletingMatch(null)
    if (res.ok) setMatches((m) => m.filter((match) => match.id !== matchId))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/tournaments/${tournament.id}`}
          className="inline-flex items-center gap-1 text-sm text-[#9a9090] hover:text-[#f5f0f0] mb-4"
        >
          <ArrowLeft size={14} />
          {tournament.name}
        </Link>
        <h1 className="text-2xl font-bold text-[#f5f0f0] mb-1">{lineup.name}</h1>
        <p className="text-xs text-[#5e5858]">Lineup · {tournament.name}</p>
      </div>

      {/* Players */}
      <div>
        <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users size={14} />
          Players ({lineup.slots.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {lineup.slots.map((slot) => (
            <span
              key={slot.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#251f20] border border-[#2d2829] px-3 py-1 text-sm text-[#c5bfbf]"
            >
              <PlayerAvatar player={slot.player} className="h-5 w-5 text-[10px]" />
              {slot.player.name}
              {isGuest(slot.player.tmId) && <GuestBadge />}
            </span>
          ))}
        </div>
      </div>

      {/* Aggregate stats */}
      {aggregates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart2 size={14} />
            Gesamtstatistik
          </h2>
          <div className="space-y-4">
            {aggregates.map((agg) => (
              <FormatStatsTable key={agg.format} agg={agg} isGuest={isGuest} />
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider flex items-center gap-2">
            <Swords size={14} />
            Matches ({matches.length})
          </h2>
          {canManage && (
            <Button onClick={openAddMatch}>
              <Plus size={16} />
              Add Match
            </Button>
          )}
        </div>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Swords size={28} className="mx-auto text-[#5e5858] mb-3" />
              <p className="text-[#9a9090] text-sm">No matches with this lineup yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <div key={match.id} className="flex items-center gap-2">
              <Link href={`/tournaments/${tournament.id}/matches/${match.id}`} className="flex-1 min-w-0">
                <Card className="hover:border-[#3a3435] transition-colors cursor-pointer">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Swords size={15} className="text-[#9a9090] shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[#f5f0f0]">
                            {match.isSeeding ? "Seeding" : match.opponent ?? "Unknown opponent"}
                          </p>
                          {match.isSeeding && (
                            <Badge variant="primary" className="text-[10px] py-0">Seeding</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#5e5858]">
                          {match.date && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {formatDay(match.date)}
                            </span>
                          )}
                          <span>{match._count.subMatches} sub-match{match._count.subMatches !== 1 ? "es" : ""}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[#5e5858] shrink-0" />
                  </CardContent>
                </Card>
              </Link>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteMatch(match.id)}
                  disabled={deletingMatch === match.id}
                  className="shrink-0 text-[#5e5858] hover:text-[#ED1F24]"
                >
                  <Trash2 size={14} />
                </Button>
              )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Match Dialog */}
      <Dialog open={canManage && showAddMatch} onClose={() => setShowAddMatch(false)}>
        <DialogTitle>Add Match</DialogTitle>
        <form onSubmit={handleCreateMatch} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Lineup</Label>
            <div className="rounded-lg border border-[#FBD00D]/50 bg-[#FBD00D]/10 px-3 py-2 text-sm">
              <span className="font-medium text-[#f5f0f0]">{lineup.name}</span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#9a9090]">
                {lineup.slots.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1">
                    {s.player.name}
                    {isGuest(s.player.tmId) && <GuestBadge />}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Match type</Label>
            <div className="flex gap-2">
              {([
                [false, "Regular Match"],
                [true, "Seeding"],
              ] as const).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setIsSeeding(value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    isSeeding === value
                      ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]"
                      : "border-[#2d2829] text-[#9a9090] hover:border-[#3a3435]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!isSeeding && (
              <p className="text-xs text-[#5e5858]">
                Creates {nonSeedingFormats.length} sub-match{nonSeedingFormats.length !== 1 ? "es" : ""} automatically:{" "}
                {nonSeedingFormats.map((f) => formatLabel(f)).join(", ") || "no non-seeding formats configured"}
              </p>
            )}
          </div>
          {!isSeeding && (
            <div className="space-y-1.5">
              <Label htmlFor="opponent">Opponent team</Label>
              <Input id="opponent" name="opponent" placeholder="Team Rockets" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={localTodayKey()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-[#5e5858]">(optional)</span></Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {matchError && <p className="text-sm text-[#ED1F24]">{matchError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowAddMatch(false)}>Cancel</Button>
            <Button type="submit" disabled={matchLoading}>{matchLoading ? "Creating…" : "Create Match"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
