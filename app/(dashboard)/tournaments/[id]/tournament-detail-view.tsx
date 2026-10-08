"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSyncedState } from "@/lib/use-synced-state"
import { PlayerAvatar } from "@/components/player-avatar"
import { GuestBadge } from "@/components/guest-badge"
import { guestTmIdsAt, tournamentReferenceDate, type PlayerStatus, type StatusChange } from "@/lib/player-status"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Plus, ArrowLeft, Calendar, ChevronRight, Swords, Trash2, Pencil, X, Users, BarChart2,
} from "lucide-react"
import { formatLabel, formatLabelLong } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface Player {
  id: string
  tmId: string
  name: string
  country?: string | null
}

// The full player list carries the status history, used to tell members from guests
interface PlayerWithStatus extends Player {
  initialStatus: PlayerStatus
  statusChanges: StatusChange[]
}

interface TournamentLineupSlot {
  id: string
  player: Player
}

interface TournamentLineup {
  id: string
  name: string
  slots: TournamentLineupSlot[]
}

interface Match {
  id: string
  isSeeding: boolean
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  tournamentLineupId?: string | null
  tournamentLineup?: { name: string } | null
  _count: { subMatches: number }
}

interface Tournament {
  id: string
  name: string
  formats: Format[]
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  createdAt: Date
  matches: Match[]
  tournamentLineups: TournamentLineup[]
}

// --- Stats types ---

interface StatsRoundResult {
  id: string
  tmId: string
  playerName: string
  timeMs: number | null
  isOurTeam: boolean
}

interface StatsRound {
  id: string
  results: StatsRoundResult[]
}

interface StatsSubMatch {
  id: string
  format: Format
  rounds: StatsRound[]
}

interface StatsMatch {
  id: string
  subMatches: StatsSubMatch[]
}

type FormatAggregate = {
  format: Format
  teamRoundsWon: number
  teamRoundsLost: number
  mapWon: number
  mapLost: number
  mapDrawn: number
  players: Map<string, { tmId: string; name: string; roundsPlayed: number; placementSum: number }>
}

function roundOutcome(results: StatsRoundResult[]): "W" | "L" | "D" | null {
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

function buildAggregates(matches: StatsMatch[]): FormatAggregate[] {
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
          p.placementSum += idx + 1
        })
      }

      if (sm.rounds.length > 0 && (smWon + smLost) > 0) {
        if (smWon > smLost) agg.mapWon++
        else if (smLost > smWon) agg.mapLost++
        else agg.mapDrawn++
      }
    }
  }

  const order: Format[] = ["TIME_ATTACK_10", "ROUND_1V1", "ROUND_2V2", "ROUND_3V3", "ROUND_4V4", "ROUND_5V5"]
  return order
    .filter((f) => byFormat.has(f) && byFormat.get(f)!.players.size > 0)
    .map((f) => byFormat.get(f)!)
}

function FormatStatsTable({ agg, lineups, isGuest }: { agg: FormatAggregate; lineups: TournamentLineup[]; isGuest: (tmId: string) => boolean }) {
  const players = Array.from(agg.players.values()).sort((a, b) => a.name.localeCompare(b.name))
  const lineupOf = (tmId: string) =>
    lineups.find((l) => l.slots.some((s) => s.player.tmId.toLowerCase() === tmId.toLowerCase()))
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
              <th className="text-left py-2 px-3 font-medium text-[#5e5858] whitespace-nowrap">Lineup</th>
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
                <td className="py-1.5 px-3 text-[#c5bfbf] whitespace-nowrap">{lineupOf(p.tmId)?.name ?? "—"}</td>
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

// ---

interface Props {
  tournament: Tournament
  players: PlayerWithStatus[]
  statsMatches: StatsMatch[]
  canManage: boolean
}

const ALL_FORMATS: Format[] = [
  "TIME_ATTACK_10",
  "ROUND_1V1",
  "ROUND_2V2",
  "ROUND_3V3",
  "ROUND_4V4",
  "ROUND_5V5",
]

function formatBadgeVariant(format: Format): "primary" | "secondary" {
  return format === "TIME_ATTACK_10" ? "primary" : "secondary"
}

function FormatBuilder({ value, onChange }: { value: Format[]; onChange: (v: Format[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ALL_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange([...value, f])}
            className="inline-flex items-center gap-1 rounded-md border border-[#2d2829] bg-[#1c1819] px-2 py-1 text-xs text-[#9a9090] hover:border-[#FBD00D]/50 hover:text-[#f5f0f0] transition-colors"
          >
            <Plus size={10} />
            {formatLabelLong(f)}
          </button>
        ))}
      </div>
      <div className="min-h-10 rounded-lg border border-[#2d2829] bg-[#0e0c0d] p-2 flex flex-wrap gap-1.5">
        {value.length === 0 && (
          <span className="text-xs text-[#5e5858] self-center">Click formats above to build the sequence</span>
        )}
        {value.map((f, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md border border-[#2d2829] bg-[#1c1819] px-2 py-0.5 text-xs text-[#f5f0f0]"
          >
            <span className="text-[#5e5858]">{i + 1}.</span>
            {formatLabel(f)}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="text-[#5e5858] hover:text-[#ED1F24] ml-0.5"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

export function TournamentDetailView({ tournament: initial, players, statsMatches, canManage }: Props) {
  const router = useRouter()
  const [tournament, setTournament] = useSyncedState(initial)
  const [matches, setMatches] = useSyncedState(initial.matches)
  const [lineups, setLineups] = useSyncedState<TournamentLineup[]>(initial.tournamentLineups)

  // Within a tournament everyone is member or guest as of its start day
  const guestTmIds = new Set(guestTmIdsAt(players, tournamentReferenceDate(tournament)))
  const isGuest = (tmId: string) => guestTmIds.has(tmId.toLowerCase())
  // Selection lists show team members first, then guests
  const playerGroups = [
    { label: null, players: players.filter((p) => !isGuest(p.tmId)) },
    { label: "Gäste", players: players.filter((p) => isGuest(p.tmId)) },
  ].filter((g) => g.players.length > 0)

  // --- Edit tournament dialog state ---
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(tournament.name)
  const [editFormats, setEditFormats] = useState<Format[]>(tournament.formats)
  const [editDescription, setEditDescription] = useState(tournament.description ?? "")
  const [editStartDate, setEditStartDate] = useState(
    tournament.startDate ? new Date(tournament.startDate).toISOString().split("T")[0] : ""
  )
  const [editEndDate, setEditEndDate] = useState(
    tournament.endDate ? new Date(tournament.endDate).toISOString().split("T")[0] : ""
  )
  const [editError, setEditError] = useState("")
  const [editLoading, setEditLoading] = useState(false)

  // --- Delete tournament state ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // --- Delete match state ---
  const [deletingMatch, setDeletingMatch] = useState<string | null>(null)

  // --- Lineup dialog state ---
  const [showLineupForm, setShowLineupForm] = useState(false)
  const [editingLineup, setEditingLineup] = useState<TournamentLineup | null>(null)
  const [lineupName, setLineupName] = useState("")
  const [lineupPlayerIds, setLineupPlayerIds] = useState<string[]>([])
  const [lineupError, setLineupError] = useState("")
  const [lineupLoading, setLineupLoading] = useState(false)
  const [deletingLineup, setDeletingLineup] = useState<string | null>(null)

  // --- Handlers ---

  async function handleEditSave() {
    if (!editName.trim() || editFormats.length === 0 || !editStartDate) {
      setEditError("Name, start date and at least one format are required.")
      return
    }
    setEditError("")
    setEditLoading(true)
    const res = await fetch(`/b2-stats/api/tournaments/${tournament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        formats: editFormats,
        description: editDescription || null,
        startDate: editStartDate,
        endDate: editEndDate || null,
      }),
    })
    setEditLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setEditError(data.error ?? "Failed to save")
      return
    }
    const data = await res.json()
    setTournament((t) => ({ ...t, ...data }))
    setShowEdit(false)
  }

  async function handleDeleteTournament() {
    setDeleteLoading(true)
    await fetch(`/b2-stats/api/tournaments/${tournament.id}`, { method: "DELETE" })
    setDeleteLoading(false)
    router.push("/tournaments")
    router.refresh()
  }

  async function handleDeleteMatch(matchId: string) {
    if (!confirm("Delete this match and all its data?")) return
    setDeletingMatch(matchId)
    await fetch(`/b2-stats/api/tournaments/${tournament.id}/matches/${matchId}`, { method: "DELETE" })
    setDeletingMatch(null)
    setMatches((m) => m.filter((match) => match.id !== matchId))
  }

  function openNewLineupForm() {
    setEditingLineup(null)
    setLineupName("")
    setLineupPlayerIds([])
    setLineupError("")
    setShowLineupForm(true)
  }

  function openEditLineupForm(lineup: TournamentLineup) {
    setEditingLineup(lineup)
    setLineupName(lineup.name)
    setLineupPlayerIds(lineup.slots.map((s) => s.player.id))
    setLineupError("")
    setShowLineupForm(true)
  }

  async function handleSaveLineup() {
    if (!lineupName.trim()) { setLineupError("Name is required."); return }
    if (lineupPlayerIds.length === 0) { setLineupError("Select at least one player."); return }
    setLineupError("")
    setLineupLoading(true)

    if (editingLineup) {
      const res = await fetch(
        `/b2-stats/api/tournaments/${tournament.id}/lineups/${editingLineup.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: lineupName.trim(), playerIds: lineupPlayerIds }),
        }
      )
      setLineupLoading(false)
      if (!res.ok) { const d = await res.json(); setLineupError(d.error ?? "Failed to save"); return }
      const data = await res.json()
      setLineups((ls) => ls.map((l) => (l.id === editingLineup.id ? data : l)))
    } else {
      const res = await fetch(`/b2-stats/api/tournaments/${tournament.id}/lineups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lineupName.trim(), playerIds: lineupPlayerIds }),
      })
      setLineupLoading(false)
      if (!res.ok) { const d = await res.json(); setLineupError(d.error ?? "Failed to save"); return }
      const data = await res.json()
      setLineups((ls) => [...ls, data])
    }

    setShowLineupForm(false)
  }

  async function handleDeleteLineup(lineupId: string) {
    if (!confirm("Delete this lineup?")) return
    setDeletingLineup(lineupId)
    await fetch(`/b2-stats/api/tournaments/${tournament.id}/lineups/${lineupId}`, { method: "DELETE" })
    setDeletingLineup(null)
    setLineups((ls) => ls.filter((l) => l.id !== lineupId))
  }

  function openEdit() {
    setEditName(tournament.name)
    setEditFormats(tournament.formats)
    setEditDescription(tournament.description ?? "")
    setEditStartDate(tournament.startDate ? new Date(tournament.startDate).toISOString().split("T")[0] : "")
    setEditEndDate(tournament.endDate ? new Date(tournament.endDate).toISOString().split("T")[0] : "")
    setEditError("")
    setShowEdit(true)
  }


  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1 text-sm text-[#9a9090] hover:text-[#f5f0f0] mb-4"
        >
          <ArrowLeft size={14} />
          Tournaments
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#f5f0f0] mb-1">{tournament.name}</h1>
            <div className="flex flex-wrap gap-1 mb-1">
              {tournament.formats.map((f, i) => (
                <Badge key={i} variant={formatBadgeVariant(f)}>
                  {formatLabel(f)}
                </Badge>
              ))}
            </div>
            {tournament.description && (
              <p className="text-[#9a9090] text-sm">{tournament.description}</p>
            )}
            {(tournament.startDate || tournament.endDate) && (
              <div className="flex items-center gap-1.5 text-xs text-[#5e5858] mt-1">
                <Calendar size={12} />
                {tournament.startDate && new Date(tournament.startDate).toLocaleDateString()}
                {tournament.startDate && tournament.endDate && " – "}
                {tournament.endDate && new Date(tournament.endDate).toLocaleDateString()}
              </div>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil size={14} />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#5e5858] hover:text-[#ED1F24]"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Lineups section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-[#f5f0f0] flex items-center gap-2">
              <Users size={18} className="text-[#FBD00D]" />
              Lineups
              <span className="text-sm font-normal text-[#5e5858]">{lineups.length}</span>
            </h2>
            <p className="text-xs text-[#9a9090] mt-0.5">Open a lineup to see its matches and add new ones.</p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openNewLineupForm}>
              <Plus size={14} />
              New Lineup
            </Button>
          )}
        </div>

        {lineups.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <Users size={22} className="mx-auto text-[#5e5858] mb-2" />
              <p className="text-[#9a9090] text-sm">No lineups yet. Create a lineup first – matches are added inside a lineup.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lineups.map((lineup) => {
              const matchCount = matches.filter((m) => m.tournamentLineupId === lineup.id).length
              return (
              <div key={lineup.id} className="relative group">
                <Link href={`/tournaments/${tournament.id}/lineups/${lineup.id}`} className="block">
                  <Card className="border-[#3a3435] hover:border-[#FBD00D]/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="text-base font-semibold text-[#f5f0f0]">{lineup.name}</p>
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-[#5e5858] hover:text-[#f5f0f0]"
                              onClick={(e) => { e.preventDefault(); openEditLineupForm(lineup) }}
                            >
                              <Pencil size={11} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-[#5e5858] hover:text-[#ED1F24]"
                              onClick={(e) => { e.preventDefault(); handleDeleteLineup(lineup.id) }}
                              disabled={deletingLineup === lineup.id}
                            >
                              <Trash2 size={11} />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {lineup.slots.map((slot) => (
                          <span
                            key={slot.id}
                            className="inline-flex items-center gap-1 rounded-full bg-[#251f20] border border-[#2d2829] px-2 py-0.5 text-xs text-[#c5bfbf]"
                          >
                            <PlayerAvatar player={slot.player} className="h-3.5 w-3.5 text-[9px]" />
                            {slot.player.name}
                            {isGuest(slot.player.tmId) && <GuestBadge />}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-[#2d2829] pt-3 text-xs">
                        <span className="flex items-center gap-1.5 text-[#9a9090]">
                          <Swords size={12} />
                          {matchCount} match{matchCount !== 1 ? "es" : ""}
                        </span>
                        <span className="flex items-center gap-0.5 font-medium text-[#FBD00D]">
                          Open lineup
                          <ChevronRight size={14} />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Gesamtstatistik */}
      {(() => {
        // Only matches that still exist locally, so deleting a match updates the stats at once
        const aggregates = buildAggregates(statsMatches.filter((sm) => matches.some((m) => m.id === sm.id)))
        if (aggregates.length === 0) return null
        return (
          <div>
            <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart2 size={14} />
              Gesamtstatistik
            </h2>
            <div className="space-y-4">
              {aggregates.map((agg) => (
                <FormatStatsTable key={agg.format} agg={agg} lineups={lineups} isGuest={isGuest} />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Matches section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider">
            Matches ({matches.length})
          </h2>
        </div>
        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Swords size={28} className="mx-auto text-[#5e5858] mb-3" />
              <p className="text-[#9a9090] text-sm">No matches yet. Open a lineup to add the first match.</p>
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
                              {match.isSeeding
                                ? "Seeding"
                                : [lineups.find((l) => l.id === match.tournamentLineupId)?.name, match.opponent].filter(Boolean).join(" vs ") || "Unknown opponent"}
                            </p>
                            {match.isSeeding && (
                              <Badge variant="primary" className="text-[10px] py-0">Seeding</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#5e5858]">
                            {match.date && (
                              <span>{new Date(match.date).toLocaleDateString()}</span>
                            )}
                            <span>
                              {match._count.subMatches} sub-match{match._count.subMatches !== 1 ? "es" : ""}
                            </span>
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

      {/* Edit Tournament Dialog */}
      <Dialog open={showEdit} onClose={() => setShowEdit(false)} className="max-w-lg">
        <DialogTitle>Edit Tournament</DialogTitle>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Tournament name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Formats</Label>
            <FormatBuilder value={editFormats} onChange={setEditFormats} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description <span className="text-[#5e5858]">(optional)</span></Label>
            <Textarea
              id="edit-desc"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Start date</Label>
              <Input
                id="edit-start"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">End date</Label>
              <Input
                id="edit-end"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
              />
            </div>
          </div>
          {editError && <p className="text-sm text-[#ED1F24]">{editError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editLoading || !editName.trim() || editFormats.length === 0}>
              {editLoading ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Tournament Confirm Dialog */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <DialogTitle>Delete Tournament</DialogTitle>
        <p className="text-sm text-[#9a9090] mb-4">
          This will permanently delete <span className="text-[#f5f0f0] font-medium">{tournament.name}</span> and all
          its lineups, matches, sub-matches, and round results. This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteTournament}
            disabled={deleteLoading}
            className="bg-[#ED1F24] hover:bg-[#ED1F24]/80 text-white border-[#ED1F24]"
          >
            {deleteLoading ? "Deleting…" : "Delete Tournament"}
          </Button>
        </div>
      </Dialog>

      {/* Create / Edit Lineup Dialog */}
      <Dialog open={showLineupForm} onClose={() => setShowLineupForm(false)} className="max-w-lg">
        <DialogTitle>{editingLineup ? "Edit Lineup" : "New Lineup"}</DialogTitle>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lineup-name">Lineup name</Label>
            <Input
              id="lineup-name"
              value={lineupName}
              onChange={(e) => setLineupName(e.target.value)}
              placeholder='e.g. "Main 4v4 Squad"'
            />
          </div>
          <div className="space-y-1.5">
            <Label>Players <span className="text-[#5e5858]">({lineupPlayerIds.length} selected)</span></Label>
            {players.length === 0 ? (
              <p className="text-sm text-[#9a9090]">
                No players yet.{" "}
                <Link href="/players" className="text-[#FBD00D] hover:underline">Add players first.</Link>
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-[#2d2829] bg-[#0e0c0d] p-3">
                {playerGroups.map((group) => (
                  <div key={group.label ?? "members"} className="space-y-2">
                    {group.label && (
                      <p className="border-t border-[#2d2829] pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#5e5858]">
                        {group.label}
                      </p>
                    )}
                {group.players.map((p) => {
                  const selected = lineupPlayerIds.includes(p.id)
                  // A player can only be in one lineup per tournament
                  const otherLineup = lineups.find(
                    (l) => l.id !== editingLineup?.id && l.slots.some((s) => s.player.id === p.id)
                  )
                  if (otherLineup) {
                    return (
                      <div key={p.id} className="flex items-center gap-3 opacity-50" title={`Already in lineup ${otherLineup.name}`}>
                        <input type="checkbox" disabled className="h-4 w-4" />
                        <span className="text-sm text-[#9a9090]">{p.name}</span>
                        {isGuest(p.tmId) && <GuestBadge />}
                        <span className="text-xs text-[#9a9090] ml-auto">in {otherLineup.name}</span>
                      </div>
                    )
                  }
                  return (
                    <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setLineupPlayerIds((ids) =>
                            selected ? ids.filter((id) => id !== p.id) : [...ids, p.id]
                          )
                        }
                        className="h-4 w-4 accent-[#FBD00D]"
                      />
                      <span className="text-sm text-[#f5f0f0] group-hover:text-white">{p.name}</span>
                      {isGuest(p.tmId) && <GuestBadge />}
                      <span className="text-xs text-[#5e5858] font-mono ml-auto">{p.tmId.slice(0, 8)}…</span>
                    </label>
                  )
                })}
                  </div>
                ))}
              </div>
            )}
          </div>
          {lineupError && <p className="text-sm text-[#ED1F24]">{lineupError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowLineupForm(false)}>Cancel</Button>
            <Button
              onClick={handleSaveLineup}
              disabled={lineupLoading || !lineupName.trim() || lineupPlayerIds.length === 0}
            >
              {lineupLoading ? "Saving…" : editingLineup ? "Save Changes" : "Create Lineup"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
