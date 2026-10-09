"use client"

import { BASE_PATH } from "@/lib/base-path"
import { lineupPath, matchPath, tournamentPath } from "@/lib/paths"
import { PlayerName } from "@/components/player-name"
import { PlayerSearch } from "@/components/player-search"
import { FormatBuilder } from "@/components/format-builder"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSyncedState } from "@/lib/use-synced-state"
import { PlayerAvatar } from "@/components/player-avatar"
import { GuestBadge } from "@/components/guest-badge"
import { formatDay, guestTmIdsAt, tournamentReferenceDate, type PlayerStatus, type StatusChange } from "@/lib/player-status"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Plus, ArrowLeft, Calendar, ChevronRight, Swords, Trash2, Pencil, X, User, Users, BarChart2,
} from "lucide-react"
import { formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { buildAggregates, matchesOfLineups, matchesOfStages, type StatsMatch } from "@/lib/format-stats"
import { sortStages, stageName, stagePlanOf, type StageRef } from "@/lib/stages"
import { useIdListParam } from "@/lib/use-id-list-param"
import { StatsFilter } from "@/components/stats-filter"
import { StageHeading } from "@/components/stage-heading"
import { StagePlanFields } from "@/components/stage-plan-fields"
import { FormatStatsTable } from "./format-stats"

interface Player {
  id: string
  tmId: string
  // Name on the tournament's start day; currentName is today's, allNames every name ever used
  name: string
  currentName?: string
  allNames?: string[]
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
  slug?: string | null
  name: string
  slots: TournamentLineupSlot[]
}

interface Match {
  id: string
  slug?: string | null
  stage: StageRef
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  tournamentLineupId?: string | null
  tournamentLineup?: { name: string } | null
  _count: { subMatches: number }
}

interface Tournament {
  id: string
  slug?: string | null
  name: string
  formats: Format[]
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  createdAt: Date
  stages: StageRef[]
  matches: Match[]
  tournamentLineups: TournamentLineup[]
}

interface Props {
  tournament: Tournament
  players: PlayerWithStatus[]
  statsMatches: StatsMatch[]
  canManage: boolean
}

function formatBadgeVariant(format: Format): "primary" | "secondary" {
  return format === "TIME_ATTACK_10" ? "primary" : "secondary"
}

export function TournamentDetailView({ tournament: initial, players, statsMatches, canManage }: Props) {
  const router = useRouter()
  const [tournament, setTournament] = useSyncedState(initial)
  const [matches, setMatches] = useSyncedState(initial.matches)
  const [lineups, setLineups] = useSyncedState<TournamentLineup[]>(initial.tournamentLineups)

  // In playing order
  const stages = sortStages(tournament.stages)
  const statsStages = stages.filter((st) => st.type !== "SEEDING")
  // What the stats are limited to; nothing selected means all
  const [statsLineupIds, selectStatsLineups] = useIdListParam("lineups", lineups.map((l) => l.id))
  const [statsStageIds, selectStatsStages] = useIdListParam("stages", statsStages.map((st) => st.id))

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
  const [editStagePlan, setEditStagePlan] = useState(() => stagePlanOf(tournament.stages))
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
    const res = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        formats: editFormats,
        description: editDescription || null,
        startDate: editStartDate,
        endDate: editEndDate || null,
        stages: editStagePlan,
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
    // A new name means a new address
    if (data.slug !== tournament.slug) router.replace(tournamentPath(data))
  }

  async function handleDeleteTournament() {
    setDeleteLoading(true)
    await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}`, { method: "DELETE" })
    setDeleteLoading(false)
    router.push("/tournaments")
    router.refresh()
  }

  async function handleDeleteMatch(matchId: string) {
    if (!confirm("Delete this match and all its data?")) return
    setDeletingMatch(matchId)
    await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/matches/${matchId}`, { method: "DELETE" })
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
        `${BASE_PATH}/api/tournaments/${tournament.id}/lineups/${editingLineup.id}`,
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
      const res = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/lineups`, {
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
    const res = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/lineups/${lineupId}`, { method: "DELETE" })
    setDeletingLineup(null)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      alert(data?.error ?? "Lineup konnte nicht gelöscht werden")
      return
    }
    setLineups((ls) => ls.filter((l) => l.id !== lineupId))
  }

  function openEdit() {
    setEditName(tournament.name)
    setEditFormats(tournament.formats)
    setEditDescription(tournament.description ?? "")
    setEditStartDate(tournament.startDate ? new Date(tournament.startDate).toISOString().split("T")[0] : "")
    setEditEndDate(tournament.endDate ? new Date(tournament.endDate).toISOString().split("T")[0] : "")
    setEditStagePlan(stagePlanOf(tournament.stages))
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
                {tournament.startDate && formatDay(tournament.startDate)}
                {tournament.startDate && tournament.endDate && " – "}
                {tournament.endDate && formatDay(tournament.endDate)}
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
                <Link href={lineupPath(tournament, lineup)} className="block">
                  <Card className="border-[#3a3435] hover:border-[#FBD00D]/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="text-base font-semibold text-[#f5f0f0]">
                          {lineup.name}
                          <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-normal text-[#9a9090]">
                            {lineup.slots.length}
                            <User size={12} />
                          </span>
                        </p>
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
                            <PlayerName name={slot.player.name} currentName={slot.player.currentName} />
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
        const existing = statsMatches.filter((sm) => matches.some((m) => m.id === sm.id))
        if (buildAggregates(existing).length === 0) return null
        const aggregates = buildAggregates(matchesOfStages(matchesOfLineups(existing, statsLineupIds), statsStageIds))
        const lineupName = (tmId: string) =>
          lineups.find((l) => l.slots.some((s) => s.player.tmId.toLowerCase() === tmId.toLowerCase()))?.name
        return (
          <div>
            <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart2 size={14} />
              Gesamtstatistik
            </h2>
            <StatsFilter
              className="mb-4"
              groups={[
                ...(lineups.length > 0
                  ? [{ label: "Lineup", options: lineups.map((l) => ({ id: l.id, label: l.name })), selected: statsLineupIds, onChange: selectStatsLineups }]
                  : []),
                ...(statsStages.length > 1
                  ? [{ label: "Abschnitt", options: statsStages.map((st) => ({ id: st.id, label: stageName(st, stages) })), selected: statsStageIds, onChange: selectStatsStages }]
                  : []),
              ]}
            />
            {aggregates.length === 0 ? (
              <p className="text-sm text-[#5e5858]">Keine Daten für diese Auswahl.</p>
            ) : (
              <div className="space-y-4">
                {aggregates.map((agg) => (
                  // With a single lineup selected the column would repeat the same name
                  <FormatStatsTable key={agg.format} agg={agg} isGuest={isGuest} lineupName={statsLineupIds.length === 1 ? undefined : lineupName} />
                ))}
              </div>
            )}
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
          <div className="space-y-5">
            {stages.map((stage) => {
              const stageMatches = matches.filter((m) => m.stage.id === stage.id)
              return (
                <div key={stage.id}>
                  <StageHeading stage={stage} stages={stages} startDate={tournament.startDate ?? tournament.createdAt} />
                  {stageMatches.length === 0 ? (
                    <p className="text-xs text-[#5e5858]">Noch keine Matches.</p>
                  ) : (
                    <div className="space-y-2">
                      {stageMatches.map((match) => (
                      <div key={match.id} className="flex items-center gap-2">
                        <Link href={matchPath(tournament, lineups.find((l) => l.id === match.tournamentLineupId) ?? { id: match.tournamentLineupId ?? "" }, match)} className="flex-1 min-w-0">
                          <Card className="hover:border-[#3a3435] transition-colors cursor-pointer">
                            <CardContent className="py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <Swords size={15} className="text-[#9a9090] shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-[#f5f0f0]">
                                      {[lineups.find((l) => l.id === match.tournamentLineupId)?.name, match.stage.type === "SEEDING" ? null : match.opponent].filter(Boolean).join(" vs ") || (match.stage.type === "SEEDING" ? "Seeding" : "Unknown opponent")}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-[#5e5858]">
                                    {match.date && (
                                      <span>{formatDay(match.date)}</span>
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
              )
            })}
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
          <StagePlanFields value={editStagePlan} onChange={setEditStagePlan} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <div className="dialog-footer flex gap-2 justify-end">
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
        <div className="dialog-footer flex gap-2 justify-end">
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
            {/* The picked players, in the order they were picked */}
            {lineupPlayerIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lineupPlayerIds.map((id) => {
                  const player = players.find((p) => p.id === id)
                  if (!player) return null
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#FBD00D]/30 bg-[#FBD00D]/10 py-0.5 pl-2.5 pr-1.5 text-xs text-[#f5f0f0]"
                    >
                      {player.name}
                      {isGuest(player.tmId) && <GuestBadge />}
                      <button
                        type="button"
                        onClick={() => setLineupPlayerIds((ids) => ids.filter((x) => x !== id))}
                        aria-label={`${player.name} entfernen`}
                        className="text-[#9a9090] hover:text-[#ED1F24]"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Players <span className="text-[#5e5858]">({lineupPlayerIds.length} selected)</span></Label>
            {players.length === 0 ? (
              <p className="text-sm text-[#9a9090]">
                No players yet.{" "}
                <Link href="/players" className="text-[#FBD00D] hover:underline">Add players first.</Link>
              </p>
            ) : (
              <>
              <PlayerSearch
                // Only players who are neither picked yet nor in another lineup of this tournament
                players={players.filter(
                  (p) =>
                    !lineupPlayerIds.includes(p.id) &&
                    !lineups.some((l) => l.id !== editingLineup?.id && l.slots.some((s) => s.player.id === p.id))
                )}
                isGuest={isGuest}
                onPick={(id) => setLineupPlayerIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
              />
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
              </>
            )}
          </div>
          {lineupError && <p className="text-sm text-[#ED1F24]">{lineupError}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
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
