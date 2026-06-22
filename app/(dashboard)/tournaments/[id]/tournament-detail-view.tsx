"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Plus, ArrowLeft, Calendar, ChevronRight, Swords, Trash2, Pencil, X, Users,
} from "lucide-react"
import { formatLabel, formatLabelLong } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface Player {
  id: string
  tmId: string
  name: string
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
  _count: { subMatches: number }
}

interface Tournament {
  id: string
  name: string
  formats: Format[]
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  matches: Match[]
  tournamentLineups: TournamentLineup[]
}

interface Props {
  tournament: Tournament
  players: Player[]
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

export function TournamentDetailView({ tournament: initial, players, canManage }: Props) {
  const router = useRouter()
  const [tournament, setTournament] = useState(initial)
  const [matches, setMatches] = useState(initial.matches)
  const [lineups, setLineups] = useState<TournamentLineup[]>(initial.tournamentLineups)

  // --- Match dialog state ---
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [matchError, setMatchError] = useState("")
  const [matchLoading, setMatchLoading] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [selectedLineupId, setSelectedLineupId] = useState<string>("")

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

  function closeAddMatch() {
    setShowAddMatch(false)
    setIsSeeding(false)
    setSelectedLineupId("")
    setMatchError("")
  }

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
        lineupId: selectedLineupId || null,
      }),
    })
    setMatchLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setMatchError(data.error ?? "Failed to create match")
      return
    }
    const data = await res.json()
    setMatches((m) => [data, ...m])
    closeAddMatch()
    router.push(`/tournaments/${tournament.id}/matches/${data.id}`)
  }

  async function handleEditSave() {
    if (!editName.trim() || editFormats.length === 0) {
      setEditError("Name and at least one format are required.")
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
        startDate: editStartDate || null,
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

  const nonSeedingFormats = tournament.formats.filter((f) => f !== "TIME_ATTACK_10")

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
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider">
            Lineups ({lineups.length})
          </h2>
          {canManage && (
            <Button variant="outline" size="sm" onClick={openNewLineupForm}>
              <Plus size={14} />
              New Lineup
            </Button>
          )}
        </div>

        {lineups.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <Users size={22} className="mx-auto text-[#5e5858] mb-2" />
              <p className="text-[#9a9090] text-sm">No lineups yet. Create a named player lineup to reuse across matches.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {lineups.map((lineup) => (
              <Card key={lineup.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-[#f5f0f0]">{lineup.name}</p>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-[#5e5858] hover:text-[#f5f0f0]"
                          onClick={() => openEditLineupForm(lineup)}
                        >
                          <Pencil size={11} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-[#5e5858] hover:text-[#ED1F24]"
                          onClick={() => handleDeleteLineup(lineup.id)}
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
                        <span className="h-3.5 w-3.5 rounded-full bg-[#FBD00D]/20 text-[#FBD00D] text-[9px] font-bold flex items-center justify-center shrink-0">
                          {slot.player.name.charAt(0).toUpperCase()}
                        </span>
                        {slot.player.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Matches section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider">
            Matches ({matches.length})
          </h2>
          {canManage && (
            <Button onClick={() => { setShowAddMatch(true); setMatchError(""); setIsSeeding(false); setSelectedLineupId("") }}>
              <Plus size={16} />
              Add Match
            </Button>
          )}
        </div>
        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Swords size={28} className="mx-auto text-[#5e5858] mb-3" />
              <p className="text-[#9a9090] text-sm">No matches yet. Add your first match.</p>
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

      {/* Add Match Dialog */}
      <Dialog open={canManage && showAddMatch} onClose={closeAddMatch}>
        <DialogTitle>Add Match</DialogTitle>
        <form onSubmit={handleCreateMatch} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Match type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsSeeding(false)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  !isSeeding
                    ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]"
                    : "border-[#2d2829] text-[#9a9090] hover:border-[#3a3435]"
                }`}
              >
                Regular Match
              </button>
              <button
                type="button"
                onClick={() => setIsSeeding(true)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isSeeding
                    ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]"
                    : "border-[#2d2829] text-[#9a9090] hover:border-[#3a3435]"
                }`}
              >
                Seeding
              </button>
            </div>
            {!isSeeding && (
              <p className="text-xs text-[#5e5858]">
                Creates {nonSeedingFormats.length} sub-match
                {nonSeedingFormats.length !== 1 ? "es" : ""} automatically:{" "}
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
            <Input id="date" name="date" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-[#5e5858]">(optional)</span></Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {lineups.length > 0 && (
            <div className="space-y-1.5">
              <Label>Our lineup <span className="text-[#5e5858]">(optional)</span></Label>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedLineupId("")}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selectedLineupId === ""
                      ? "border-[#3a3435] bg-[#251f20] text-[#9a9090]"
                      : "border-[#2d2829] text-[#5e5858] hover:border-[#3a3435]"
                  }`}
                >
                  — none —
                </button>
                {lineups.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedLineupId(l.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selectedLineupId === l.id
                        ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]"
                        : "border-[#2d2829] text-[#9a9090] hover:border-[#3a3435]"
                    }`}
                  >
                    <span className="font-medium">{l.name}</span>
                    <span className="text-[#5e5858] ml-2 text-xs">
                      {l.slots.map((s) => s.player.name).join(", ")}
                    </span>
                  </button>
                ))}
              </div>
              {selectedLineupId && (
                <p className="text-xs text-[#5e5858]">
                  Players will be pre-assigned as "our team" in each sub-match — CSV import will identify them automatically.
                </p>
              )}
            </div>
          )}
          {matchError && <p className="text-sm text-[#ED1F24]">{matchError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={closeAddMatch}>Cancel</Button>
            <Button type="submit" disabled={matchLoading}>{matchLoading ? "Creating…" : "Create Match"}</Button>
          </div>
        </form>
      </Dialog>

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
                {players.map((p) => {
                  const selected = lineupPlayerIds.includes(p.id)
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
                      <span className="text-xs text-[#5e5858] font-mono ml-auto">{p.tmId.slice(0, 8)}…</span>
                    </label>
                  )
                })}
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
