"use client"

import { BASE_PATH } from "@/lib/base-path"
import { matchPath, tournamentPath } from "@/lib/paths"
import { PlayerName } from "@/components/player-name"
import { GuestBadge } from "@/components/guest-badge"
import { PlayerAvatar } from "@/components/player-avatar"
import { useSyncedState } from "@/lib/use-synced-state"
import { formatDay } from "@/lib/player-status"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { buildAggregates, matchesOfStages } from "@/lib/format-stats"
import { sortStages, stageDate, stageName, suggestStage, type StageRef } from "@/lib/stages"
import { useIdListParam } from "@/lib/use-id-list-param"
import { StatsFilter } from "@/components/stats-filter"
import { StageHeading } from "@/components/stage-heading"
import { Select } from "@/components/ui/select"
import { FormatStatsTable } from "../format-stats"
import { ArrowLeft, Swords, Users, ChevronRight, Calendar, BarChart2, Plus, Trash2 } from "lucide-react"
import { formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface RoundResult {
  id: string
  tmId: string
  playerName: string
  currentName?: string
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
  slug?: string | null
  stage: StageRef
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  _count: { subMatches: number }
  subMatches: SubMatch[]
}

interface Player {
  id: string
  name: string
  currentName?: string
  tmId: string
  country?: string | null
}

interface Props {
  lineup: {
    id: string
    slug?: string | null
    name: string
    tournament: { id: string; slug?: string | null; name: string; formats: Format[]; startDate: Date | null; createdAt: Date; stages: StageRef[] }
    slots: Array<{ id: string; player: Player }>
    matches: Match[]
  }
  // Lower-cased TM IDs of players who are guests in this tournament
  guestTmIds: string[]
  canManage: boolean
}

export function LineupMatchesView({ lineup, guestTmIds, canManage }: Props) {
  const guests = new Set(guestTmIds)
  const isGuest = (tmId: string) => guests.has(tmId.toLowerCase())
  const router = useRouter()
  const { tournament } = lineup
  const [matches, setMatches] = useSyncedState(lineup.matches)
  // In playing order
  const stages = sortStages(tournament.stages)
  const statsStages = stages.filter((st) => st.type !== "SEEDING")
  const startDate = tournament.startDate ?? tournament.createdAt
  // Stages the stats are limited to; nothing selected means all
  const [statsStageIds, selectStatsStages] = useIdListParam("stages", statsStages.map((st) => st.id))
  const hasStats = buildAggregates(matches).length > 0
  const aggregates = buildAggregates(matchesOfStages(matches, statsStageIds))
  const nonSeedingFormats = tournament.formats.filter((f) => f !== "TIME_ATTACK_10")

  // --- Add match dialog state ---
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [stageId, setStageId] = useState("")
  const [matchDate, setMatchDate] = useState("")
  const isSeeding = stages.find((st) => st.id === stageId)?.type === "SEEDING"
  const [matchError, setMatchError] = useState("")
  const [matchLoading, setMatchLoading] = useState(false)
  const [deletingMatch, setDeletingMatch] = useState<string | null>(null)

  // A match is played on the day of its stage unless another date is entered
  function selectStage(id: string) {
    const stage = stages.find((st) => st.id === id)
    setStageId(id)
    setMatchDate(stage ? stageDate(stage, stages, new Date(startDate)).toISOString().slice(0, 10) : "")
  }

  function openAddMatch() {
    selectStage(suggestStage(stages, matches.map((m) => m.stage.id))?.id ?? "")
    setMatchError("")
    setShowAddMatch(true)
  }

  // New matches always belong to this lineup
  async function handleCreateMatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMatchError("")
    setMatchLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stageId,
        opponent: form.get("opponent") || null,
        date: matchDate || null,
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
    router.push(matchPath(tournament, lineup, data))
  }

  async function handleDeleteMatch(matchId: string) {
    if (!confirm("Delete this match and all its data?")) return
    setDeletingMatch(matchId)
    const res = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/matches/${matchId}`, { method: "DELETE" })
    setDeletingMatch(null)
    if (res.ok) setMatches((m) => m.filter((match) => match.id !== matchId))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href={tournamentPath(tournament)}
          className="inline-flex items-center gap-1 text-sm text-[#9a9090] hover:text-[#f5f0f0] mb-4"
        >
          <ArrowLeft size={14} />
          {tournament.name}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#f5f0f0] mb-1">{lineup.name}</h1>
            <p className="text-xs text-[#5e5858]">Lineup · {tournament.name}</p>
          </div>
          {canManage && (
            <Button onClick={openAddMatch} className="shrink-0">
              <Plus size={16} />
              Add Match
            </Button>
          )}
        </div>
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
              <PlayerName name={slot.player.name} currentName={slot.player.currentName} />
              {isGuest(slot.player.tmId) && <GuestBadge />}
            </span>
          ))}
        </div>
      </div>

      {/* Aggregate stats */}
      {hasStats && (
        <div>
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart2 size={14} />
            Gesamtstatistik
          </h2>
          {statsStages.length > 1 && (
            <StatsFilter
              className="mb-4"
              groups={[
                { label: "Abschnitt", options: statsStages.map((st) => ({ id: st.id, label: stageName(st, stages) })), selected: statsStageIds, onChange: selectStatsStages },
              ]}
            />
          )}
          {aggregates.length === 0 ? (
            <p className="text-sm text-[#5e5858]">Keine Daten für diese Auswahl.</p>
          ) : (
            <div className="space-y-4">
              {aggregates.map((agg) => (
                <FormatStatsTable key={agg.format} agg={agg} isGuest={isGuest} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider flex items-center gap-2">
            <Swords size={14} />
            Matches ({matches.length})
          </h2>
        </div>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Swords size={28} className="mx-auto text-[#5e5858] mb-3" />
              <p className="text-[#9a9090] text-sm">No matches with this lineup yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {stages.map((stage) => {
              const stageMatches = matches.filter((m) => m.stage.id === stage.id)
              return (
                <div key={stage.id}>
                  <StageHeading stage={stage} stages={stages} startDate={startDate} />
                  {stageMatches.length === 0 ? (
                    <p className="text-xs text-[#5e5858]">Noch keine Matches.</p>
                  ) : (
                    <div className="space-y-2">
                      {stageMatches.map((match) => (
                      <div key={match.id} className="flex items-center gap-2">
                      <Link href={matchPath(tournament, lineup, match)} className="flex-1 min-w-0">
                        <Card className="hover:border-[#3a3435] transition-colors cursor-pointer">
                          <CardContent className="py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <Swords size={15} className="text-[#9a9090] shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-[#f5f0f0]">
                                    {match.stage.type === "SEEDING" ? "Seeding" : match.opponent ?? "Unknown opponent"}
                                  </p>
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
              )
            })}
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
            <Label htmlFor="stage">Abschnitt</Label>
            <Select id="stage" value={stageId} onChange={(e) => selectStage(e.target.value)} required>
              {stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {stageName(st, stages)} · {formatDay(stageDate(st, stages, new Date(startDate)))}
                </option>
              ))}
            </Select>
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
            <Input id="date" name="date" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
            <p className="text-xs text-[#5e5858]">Vorbelegt mit dem Tag des Abschnitts; nur ändern, wenn das Match an einem anderen Tag gespielt wird.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-[#5e5858]">(optional)</span></Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {matchError && <p className="text-sm text-[#ED1F24]">{matchError}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowAddMatch(false)}>Cancel</Button>
            <Button type="submit" disabled={matchLoading}>{matchLoading ? "Creating…" : "Create Match"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
