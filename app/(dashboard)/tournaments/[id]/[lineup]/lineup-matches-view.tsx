"use client"

import { OpponentPicker, type OpponentValue } from "@/components/opponents/opponent-picker"
import { Badge } from "@/components/ui/badge"
import { BASE_PATH } from "@/lib/base-path"
import { matchPath, planPath, tournamentPath } from "@/lib/paths"
import { PlayerName } from "@/components/player-name"
import { GuestBadge } from "@/components/guest-badge"
import { TrialBadge } from "@/components/trial-badge"
import { PlayerAvatar } from "@/components/player-avatar"
import { useSyncedState } from "@/lib/use-synced-state"
import { formatDay, localTodayKey } from "@/lib/player-status"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { buildAggregates, matchesOfFormats, matchesOfStages } from "@/lib/format-stats"
import { buildMapAggregates } from "@/lib/map-stats"
import { matchTag, nextMatchNumber, sortMatches } from "@/lib/match-order"
import { planningStage, sortStages, stageDate, stageName, suggestStage, type StageRef } from "@/lib/stages"
import { useIdListParam } from "@/lib/use-id-list-param"
import { StatsFilter } from "@/components/stats-filter"
import { StageHeading } from "@/components/stage-heading"
import { Select } from "@/components/ui/select"
import { FormatStatsTable } from "../format-stats"
import { MapOverviewTable, MapStatsTable, StatsViewToggle } from "../map-stats"
import { ArrowLeft, ClipboardList, Swords, Users, ChevronDown, ChevronRight, Calendar, BarChart2, Plus, Trash2, ShieldCheck } from "lucide-react"
import { cn, formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { lineupPoints, type CompRules } from "@/lib/match-rules"

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
  number?: number | null
  label?: string | null
  createdAt: Date
  closedAt?: Date | null
  confirmedOutcome?: string | null
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
    // Accounts responsible for the lineup
    managers: Array<{ user: { id: string; name: string; role: string; playerId: string | null } }>
    matches: Match[]
  }
  // Format rules of the tournament, for the points of the lineup
  rules: CompRules
  // Lower-cased TM IDs of players who are guests in this tournament
  guestTmIds: string[]
  // Likewise for players on trial
  trialTmIds: string[]
  // Profile addresses of our players, by lower-cased TM ID
  profilePaths: Record<string, string>
  // Admin or manager: everything, including deleting matches
  canManage: boolean
  // May add matches and maintain results of this lineup (managers, and whoever is responsible for it)
  canEdit: boolean
  editExpired?: boolean
  // Matches set up ahead without a result yet (docs/adr/008); empty while the planning is switched off
  plannedMatchIds: string[]
  // Whether the signed-in user may plan the match days of this lineup (planning switched on and canEdit)
  canPlan: boolean
}

export function LineupMatchesView({ lineup, rules, guestTmIds, trialTmIds, profilePaths, canManage, canEdit, editExpired, plannedMatchIds, canPlan }: Props) {
  const profilePath = (tmId: string) => profilePaths[tmId.toLowerCase()]
  const responsiblePlayerIds = new Set(lineup.managers.map((m) => m.user.playerId))
  const guests = new Set(guestTmIds)
  const isGuest = (tmId: string) => guests.has(tmId.toLowerCase())
  const isTrial = (tmId: string) => trialTmIds.includes(tmId.toLowerCase())
  const router = useRouter()
  const { tournament } = lineup
  const [matches, setMatches] = useSyncedState(lineup.matches)
  const points = lineupPoints(matches.map((m) => ({ ...m, stageType: m.stage.type })), rules)
  // In playing order
  const stages = sortStages(tournament.stages)
  const statsStages = stages.filter((st) => st.type !== "SEEDING")
  const startDate = tournament.startDate ?? tournament.createdAt
  // Stages the stats are limited to; nothing selected means all
  const [statsStageIds, selectStatsStages] = useIdListParam("stages", statsStages.map((st) => st.id))
  const hasStats = buildAggregates(matches).length > 0
  // On the page of a lineup its matches are what one comes for, so the list starts open
  const [showMatches, setShowMatches] = useState(true)
  const nonSeedingFormats = tournament.formats.filter((f) => f !== "TIME_ATTACK_10")
  const statsFormats = [...new Set(nonSeedingFormats)]
  const [statsFormatIds, selectStatsFormats] = useIdListParam("formats", statsFormats)
  // Tables per format, or per map
  const [statsView, selectStatsView] = useIdListParam("view", ["map"])
  const statsByMap = statsView.includes("map")
  const statsSelection = matchesOfFormats(matchesOfStages(matches, statsStageIds), statsFormatIds as Format[])
  const aggregates = buildAggregates(statsSelection)
  // Needed in both views: the overview of the maps stands above either kind of table
  const mapAggregates = buildMapAggregates(statsSelection, stages.map((st) => st.id))

  // --- Add match dialog state ---
  // The match day planning links here with ?addMatch=<stage>: the dialog opens for that stage
  const addMatchFor = useSearchParams().get("addMatch")
  const openingStage = canEdit ? stages.find((st) => st.id === addMatchFor) : undefined
  // The planning opens on the next match day; it switches between the days itself
  const planStage = canPlan ? planningStage(stages, new Date(startDate), localTodayKey()) : undefined
  const dayOf = (stage: StageRef | undefined) => (stage ? stageDate(stage, stages, new Date(startDate)).toISOString().slice(0, 10) : "")
  const [opponentValue, setOpponentValue] = useState<OpponentValue>({ name: "" })
  const [showAddMatch, setShowAddMatch] = useState(!!openingStage)
  const [stageId, setStageId] = useState(openingStage?.id ?? "")
  const [matchDate, setMatchDate] = useState(dayOf(openingStage))
  const [matchNumber, setMatchNumber] = useState(openingStage ? String(nextMatchNumber(lineup.matches)) : "")
  const isSeeding = stages.find((st) => st.id === stageId)?.type === "SEEDING"
  const [matchError, setMatchError] = useState("")
  const [matchLoading, setMatchLoading] = useState(false)
  const [deletingMatch, setDeletingMatch] = useState<string | null>(null)

  // A match is played on the day of its stage unless another date is entered
  function selectStage(id: string) {
    const stage = stages.find((st) => st.id === id)
    setStageId(id)
    setMatchDate(dayOf(stage))
  }

  function openAddMatch() {
    selectStage(suggestStage(stages, matches.map((m) => m.stage.id))?.id ?? "")
    setMatchError("")
    setOpponentValue({ name: "" })
    // Numbered on through the tournament, whatever the stage
    setMatchNumber(String(nextMatchNumber(matches)))
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
        opponent: opponentValue.name || null,
        opponentLineupId: opponentValue.lineupId,
        opponentTeamId: opponentValue.teamId,
        date: matchDate || null,
        notes: form.get("notes") || null,
        number: matchNumber ? Number(matchNumber) : null,
        label: (form.get("label") as string | null)?.trim() || null,
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
    <div className="space-y-6 page-wide">
      {/* Breadcrumb */}
      <div>
        <Link
          href={tournamentPath(tournament)}
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg mb-4"
        >
          <ArrowLeft size={14} />
          {tournament.name}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-fg mb-1 page-title">{lineup.name}</h1>
            <p className="text-xs text-fg-subtle">
              Lineup · {tournament.name}
              {points !== null && <span title="Points from the group stage"> · {points} pts</span>}
            </p>
          </div>
          {(canEdit || planStage) && (
            <div className="flex flex-wrap items-center gap-2">
              {planStage && (
                <Link href={planPath(tournament, lineup, planStage)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-fg-subtle hover:bg-raised max-md:min-h-11">
                  <ClipboardList size={16} />
                  Plan
                </Link>
              )}
              {canEdit && (
                <Button onClick={() => openAddMatch()} className="shrink-0">
                  <Plus size={16} />
                  Add Match
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* From 1536px on stats and matches stand on the left, the players on the right */}
      <div className="page-columns">
      {/* Players */}
      <div>
        <h2 className="text-sm font-semibold text-fg-muted  mb-3 flex items-center gap-2">
          <Users size={14} />
          Players ({lineup.slots.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {lineup.slots.map((slot) => (
            <span
              key={slot.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                // Players who are responsible for the lineup stand out
                responsiblePlayerIds.has(slot.player.id)
                  ? "border-brand/50 bg-brand/10 text-fg"
                  : "border-line bg-raised text-fg-soft"
              )}
            >
              <PlayerAvatar player={slot.player} className="h-5 w-5 text-[10px]" />
              <Link href={profilePath(slot.player.tmId) ?? "/players"} className="hover:text-brand-ink">
                <PlayerName name={slot.player.name} currentName={slot.player.currentName} />
              </Link>
              {isGuest(slot.player.tmId) && <GuestBadge />}
{isTrial(slot.player.tmId) && <TrialBadge />}
              {responsiblePlayerIds.has(slot.player.id) && <ShieldCheck size={13} className="text-brand-ink" aria-label="responsible" />}
            </span>
          ))}
        </div>
        {lineup.managers.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-fg-muted">
            <ShieldCheck size={14} className="text-brand-ink" />
            Responsible:
            {lineup.managers.map(({ user }) => (
              <span key={user.id} className="inline-flex items-center gap-1.5 text-fg">
                {user.name}
                <Badge variant={user.role === "PLAYER" ? "primary" : "default"}>
                  {user.role === "ADMIN" ? "Admin" : user.role === "MANAGER" ? "Manager" : "Lineup-Manager"}
                </Badge>
              </span>
            ))}
          </p>
        )}
        {editExpired && (
          <p className="mt-2 text-xs text-bronze">
            The tournament ended more than a week ago. Changes to matches and results now go through a manager.
          </p>
        )}
      </div>

      <div className={cn("space-y-6", hasStats && "page-main")}>
      {/* Aggregate stats */}
      {hasStats && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg-muted  flex items-center gap-2">
              <BarChart2 size={14} />
              Overall stats
            </h2>
            <StatsViewToggle byMap={statsByMap} onChange={(byMap) => selectStatsView(byMap ? ["map"] : [])} />
          </div>
          {(statsStages.length > 1 || statsFormats.length > 1) && (
            <StatsFilter
              className="mb-4"
              groups={[
                ...(statsStages.length > 1
                  ? [{ label: "Stage", options: statsStages.map((st) => ({ id: st.id, label: stageName(st, stages) })), selected: statsStageIds, onChange: selectStatsStages }]
                  : []),
                ...(statsFormats.length > 1
                  ? [{ label: "Format", options: statsFormats.map((f) => ({ id: f, label: formatLabel(f) })), selected: statsFormatIds, onChange: selectStatsFormats }]
                  : []),
              ]}
            />
          )}
          {aggregates.length === 0 ? (
            <p className="text-sm text-fg-subtle">No data for this selection.</p>
          ) : (
            <div className="mb-4 space-y-2">
              <h3 className="text-xs font-semibold  text-fg-subtle">Maps at a glance</h3>
              <MapOverviewTable maps={mapAggregates} />
            </div>
          )}
          {aggregates.length === 0 ? null : statsByMap ? (
            <div className="space-y-4">
              {mapAggregates.map((agg) => (
                <MapStatsTable key={agg.track ?? ""} agg={agg} isGuest={isGuest} isTrial={isTrial} profilePath={profilePath} showPlacement={aggregates.length === 1} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {aggregates.map((agg) => (
                <FormatStatsTable key={agg.format} agg={agg} isGuest={isGuest} isTrial={isTrial} profilePath={profilePath} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matches */}
      <div>
        {matches.length === 0 ? (
          <h2 className="mb-3 text-sm font-semibold text-fg-muted  flex items-center gap-2">
            <Swords size={14} />
            Matches (0)
          </h2>
        ) : (
          <button
            type="button"
            onClick={() => setShowMatches((o) => !o)}
            aria-expanded={showMatches}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:bg-raised/50"
          >
            <h2 className="text-sm font-semibold text-fg-muted  flex items-center gap-2">
              <Swords size={14} />
              Matches ({matches.length})
            </h2>
            <ChevronDown size={16} className={cn("shrink-0 text-fg-muted transition-transform", showMatches && "rotate-180")} />
          </button>
        )}

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Swords size={28} className="mx-auto text-fg-subtle mb-3" />
              <p className="text-fg-muted text-sm">No matches with this lineup yet.</p>
            </CardContent>
          </Card>
        ) : showMatches && (
          <div className="mt-4 space-y-5">
            {stages.map((stage) => {
              const stageMatches = sortMatches(matches.filter((m) => m.stage.id === stage.id))
              return (
                <div key={stage.id}>
                  <StageHeading stage={stage} stages={stages} startDate={startDate} />
                  {stageMatches.length === 0 ? (
                    <p className="text-xs text-fg-subtle">No matches yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {stageMatches.map((match) => (
                      <div key={match.id} className="flex items-center gap-2">
                      <Link href={matchPath(tournament, lineup, match)} className="flex-1 min-w-0">
                        <Card className="hover:border-line-strong transition-colors cursor-pointer">
                          <CardContent className="py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <Swords size={15} className="text-fg-muted shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-fg">
                                    {matchTag(match) && <span className="mr-2 tabular-nums text-xs text-brand-ink">{matchTag(match)}</span>}
                                    {match.stage.type === "SEEDING" ? "Seeding" : match.opponent ?? "Unknown opponent"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-fg-subtle">
                                  {match.date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar size={10} />
                                      {formatDay(match.date)}
                                    </span>
                                  )}
                                  {plannedMatchIds.includes(match.id) ? (
                                    <Badge variant="secondary">upcoming</Badge>
                                  ) : (
                                    <span>{match._count.subMatches} sub-match{match._count.subMatches !== 1 ? "es" : ""}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-fg-subtle shrink-0" />
                          </CardContent>
                        </Card>
                      </Link>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMatch(match.id)}
                          disabled={deletingMatch === match.id}
                          className="shrink-0 text-fg-subtle hover:text-danger"
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
      </div>
      </div>

      {/* Add Match Dialog */}
      <Dialog open={canEdit && showAddMatch} onClose={() => setShowAddMatch(false)}>
        <DialogTitle>Add Match</DialogTitle>
        <form onSubmit={handleCreateMatch} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Lineup</Label>
            <div className="rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-sm">
              <span className="font-medium text-fg">{lineup.name}</span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
                {lineup.slots.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1">
                    {s.player.name}
                    {isGuest(s.player.tmId) && <GuestBadge />}
{isTrial(s.player.tmId) && <TrialBadge />}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stage">Stage</Label>
            <Select id="stage" value={stageId} onChange={(e) => selectStage(e.target.value)} required>
              {stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {stageName(st, stages)} · {formatDay(stageDate(st, stages, new Date(startDate)))}
                </option>
              ))}
            </Select>
            {!isSeeding && (
              <p className="text-xs text-fg-subtle">
                Creates {nonSeedingFormats.length} sub-match{nonSeedingFormats.length !== 1 ? "es" : ""} automatically:{" "}
                {nonSeedingFormats.map((f) => formatLabel(f)).join(", ") || "no non-seeding formats configured"}
              </p>
            )}
          </div>
          {!isSeeding && (
            <div className="space-y-1.5">
              <Label htmlFor="opponent">Opponent team</Label>
              <OpponentPicker competitionId={tournament.id} value={opponentValue} onChange={setOpponentValue} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="number">Number</Label>
              <Input id="number" type="number" min={1} max={999} inputMode="numeric" value={matchNumber} onChange={(e) => setMatchNumber(e.target.value)} placeholder="#" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label">Name <span className="text-fg-subtle">(optional)</span></Label>
              <Input id="label" name="label" maxLength={60} placeholder="e.g. Upper Final" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-fg-subtle">The number counts on through the whole tournament. Within a stage the matches are listed in this order.</p>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
            <p className="text-xs text-fg-subtle">Prefilled with the day of the stage; only change it if the match is played on another day.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-fg-subtle">(optional)</span></Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {matchError && <p className="text-sm text-danger">{matchError}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowAddMatch(false)}>Cancel</Button>
            <Button type="submit" disabled={matchLoading}>{matchLoading ? "Creating…" : "Create Match"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
