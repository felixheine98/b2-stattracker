"use client"

import { PlayerAvatar } from "@/components/player-avatar"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Swords, Users, ChevronRight, Calendar, BarChart2 } from "lucide-react"
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
    tournament: { id: string; name: string }
    slots: Array<{ id: string; player: Player }>
    matches: Match[]
  }
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

function FormatStatsTable({ agg }: { agg: FormatAggregate }) {
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
                <td className="py-1.5 pl-3 pr-4 text-[#f5f0f0] font-medium">{p.name}</td>
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

export function LineupMatchesView({ lineup }: Props) {
  const { tournament } = lineup
  const aggregates = buildAggregates(lineup.matches)

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
              <FormatStatsTable key={agg.format} agg={agg} />
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      <div>
        <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Swords size={14} />
          Matches ({lineup.matches.length})
        </h2>

        {lineup.matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Swords size={28} className="mx-auto text-[#5e5858] mb-3" />
              <p className="text-[#9a9090] text-sm">No matches with this lineup yet.</p>
              <p className="text-xs text-[#5e5858] mt-1">
                When creating a match, select this lineup to track it here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {lineup.matches.map((match) => (
              <Link key={match.id} href={`/tournaments/${tournament.id}/matches/${match.id}`}>
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
                              {new Date(match.date).toLocaleDateString()}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
