"use client"

import { BASE_PATH } from "@/lib/base-path"
import { lineupPath, matchPath, tournamentPath } from "@/lib/paths"
import { PlayerName } from "@/components/player-name"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatLabel, formatLabelLong, formatTime, teamSize } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { ArrowLeft, BarChart2, ChevronDown, ChevronUp, Clock, Download, ExternalLink, Grid3x3, Trophy, Upload, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSyncedState } from "@/lib/use-synced-state"
import { PlayerAvatar } from "@/components/player-avatar"
import { GuestBadge } from "@/components/guest-badge"
import { Wdl } from "@/components/wdl"
import { roundPlacements, roundScore } from "@/lib/round-score"
import { dayKey, formatDay } from "@/lib/player-status"
import { sortStages, stageDate, stageName, type StageRef } from "@/lib/stages"
import { useMemo, useState } from "react"
import { EcmImportDialog } from "./ecm-import-dialog"
import { RoundEntryDialog } from "./round-entry-dialog"

export interface Player {
  id: string
  tmId: string
  // Name on the tournament's start day; currentName is today's, allNames every name ever used
  name: string
  currentName?: string
  allNames?: string[]
  country?: string | null
}

interface RoundResult {
  id: string
  tmId: string
  playerName: string
  currentName?: string
  timeMs: number | null
  dnf?: boolean
  isOurTeam: boolean
  playerId?: string | null
  player?: { id: string; name: string } | null
}

export interface Round {
  id: string
  number: number
  track?: string | null
  results: RoundResult[]
}

interface Lineup {
  id: string
  slots: Array<{ id: string; player: Player }>
}

export interface SubMatch {
  id: string
  format: Format
  order: number
  lineup?: Lineup | null
  rounds: Round[]
}

interface TournamentLineup {
  id: string
  slug?: string | null
  name: string
  slots: Array<{ id: string; player: Player }>
}

interface Match {
  id: string
  slug?: string | null
  stage: StageRef
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  ecmUrl?: string | null
  tournamentLineup?: TournamentLineup | null
  tournament: {
    id: string
    slug?: string | null
    name: string
    formats: Format[]
    startDate?: Date | null
    createdAt: Date
    stages: StageRef[]
    tournamentLineups: TournamentLineup[]
  }
  subMatches: SubMatch[]
}

type SortCol = "name" | "played" | "placementSum" | "avg" | "dnfs" | "bestTime" | "medianTime" | "avgTime"

// Player stats of one sub-match; the result is part of the heading instead of repeating in every row
function SubMatchStatsTable({ sm, number, isGuest }: { sm: SubMatch; number: number; isGuest: (tmId: string) => boolean }) {
  const [sortCol, setSortCol] = useState<SortCol>("avg")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const teamStats = useMemo(() => computeStats(sm.rounds), [sm.rounds])

  const rows = useMemo(() => {
    const playerMap = new Map<string, { id: string | null; tmId: string; name: string; currentName?: string }>()
    for (const round of sm.rounds) {
      for (const r of round.results) {
        if (r.isOurTeam && !playerMap.has(r.tmId)) {
          playerMap.set(r.tmId, { id: r.playerId ?? null, tmId: r.tmId, name: r.playerName, currentName: r.currentName })
        }
      }
    }
    return Array.from(playerMap.values()).map((p) => {
      let roundsPlayed = 0
      let placementSum = 0
      let dnfs = 0
      const times: number[] = []
      for (const round of sm.rounds) {
        const result = round.results.find(
          (r) => r.isOurTeam && ((p.id && r.playerId === p.id) || r.tmId === p.tmId)
        )
        if (!result) continue
        roundsPlayed++
        placementSum += roundPlacements(round.results)[round.results.indexOf(result)]
        if (result.dnf) dnfs++
        if (result.timeMs != null) times.push(result.timeMs)
      }
      const sortedTimes = [...times].sort((a, b) => a - b)
      const bestTime = sortedTimes[0] ?? null
      const avgTime = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : null
      const mid = Math.floor(sortedTimes.length / 2)
      const medianTime = sortedTimes.length === 0 ? null
        : sortedTimes.length % 2 === 1 ? sortedTimes[mid]
        : (sortedTimes[mid - 1] + sortedTimes[mid]) / 2
      return {
        tmId: p.tmId,
        name: p.name,
        currentName: p.currentName,
        roundsPlayed,
        placementSum,
        avg: roundsPlayed > 0 ? placementSum / roundsPlayed : 0,
        dnfs,
        bestTime,
        medianTime,
        avgTime,
      }
    })
  }, [sm.rounds])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (sortCol === "name") cmp = a.name.localeCompare(b.name)
      else if (sortCol === "played") cmp = a.roundsPlayed - b.roundsPlayed
      else if (sortCol === "placementSum") cmp = a.placementSum - b.placementSum
      else if (sortCol === "avg") cmp = a.avg - b.avg
      else if (sortCol === "dnfs") cmp = a.dnfs - b.dnfs
      else if (sortCol === "bestTime") cmp = (a.bestTime ?? Infinity) - (b.bestTime ?? Infinity)
      else if (sortCol === "medianTime") cmp = (a.medianTime ?? Infinity) - (b.medianTime ?? Infinity)
      else if (sortCol === "avgTime") cmp = (a.avgTime ?? Infinity) - (b.avgTime ?? Infinity)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortCol(col); setSortDir("asc") }
  }

  const track = sm.rounds[0]?.track
  const resultColor = teamStats.ourRoundsWon > teamStats.ourRoundsLost ? "text-[#FBD00D]"
    : teamStats.ourRoundsLost > teamStats.ourRoundsWon ? "text-[#ED1F24]" : "text-[#9a9090]"

  function th(col: SortCol, label: string, left?: boolean) {
    const active = sortCol === col
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`py-1.5 px-2 font-medium cursor-pointer select-none whitespace-nowrap group ${left ? "sticky left-0 z-[1] bg-[#0e0b0b] text-left pl-3 pr-4" : "text-right"}`}
      >
        <span className="inline-flex items-center gap-1 justify-end">
          <span className={`transition-colors ${active ? "text-[#f5f0f0]" : "text-[#5e5858] group-hover:text-[#9a9090]"}`}>
            {label}
          </span>
          <span className={`text-[9px] transition-colors ${active ? "text-[#FBD00D]" : "text-[#2d2829] group-hover:text-[#3a3435]"}`}>
            {active && sortDir === "desc" ? "▼" : "▲"}
          </span>
        </span>
      </th>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={sm.format === "TIME_ATTACK_10" ? "primary" : "secondary"}>
          {formatLabel(sm.format)}
        </Badge>
        <span className="text-sm text-[#f5f0f0]">{track || `#${number}`}</span>
        <Wdl won={teamStats.ourRoundsWon} drawn={teamStats.ourRoundsDrawn} lost={teamStats.ourRoundsLost} unit="Runden" className={`text-sm font-bold ${resultColor}`} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#2d2829]">
      {/* Fixed column widths, so the columns line up across the tables of a match */}
      <table className="w-full min-w-[720px] table-fixed text-xs">
        <colgroup>
          <col className="w-[22%]" />
          <col span={7} />
        </colgroup>
        <thead>
          <tr className="border-b border-[#2d2829]">
            {th("name", "Spieler", true)}
            {th("played", "Gespielt")}
            {th("placementSum", "Platzsumme")}
            {th("avg", "Ø Platz")}
            {th("dnfs", "DNF")}
            {th("bestTime", "Beste Zeit")}
            {th("medianTime", "Median Zeit")}
            {th("avgTime", "Ø Zeit")}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="py-3 text-center text-[#5e5858]">Noch keine Daten</td>
            </tr>
          )}
          {sorted.map((row) => (
            <tr key={row.tmId} className="border-b border-[#1c1819] hover:bg-[#1c1819]/50">
              <td className="sticky left-0 z-[1] bg-[#0e0b0b] py-1.5 pl-3 pr-4 text-[#f5f0f0] font-medium whitespace-nowrap max-md:shadow-[1px_0_0_#2d2829]">
                <PlayerName name={row.name} currentName={row.currentName} />
                {isGuest(row.tmId) && <GuestBadge className="ml-1.5" />}
              </td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf]">{row.roundsPlayed}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf]">{row.placementSum}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf] font-mono">
                {row.avg > 0 ? row.avg.toFixed(3) : "—"}
              </td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf]">{row.dnfs}</td>
              <td className="py-1.5 px-2 text-right text-[#FBD00D] font-mono">{row.bestTime != null ? formatTime(row.bestTime) : "—"}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf] font-mono">{row.medianTime != null ? formatTime(Math.round(row.medianTime)) : "—"}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf] font-mono">{row.avgTime != null ? formatTime(Math.round(row.avgTime)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

interface Props {
  match: Match
  allPlayers: Player[]
  // Lower-cased TM IDs of players who are guests in this tournament
  guestTmIds: string[]
  canManage: boolean
  // Open the eCM import dialog right away (the import page sends people here with the data)
  autoEcmImport?: boolean
}

export function MatchDetailView({ match: initialMatch, allPlayers, guestTmIds, canManage, autoEcmImport = false }: Props) {
  const router = useRouter()
  const guests = new Set(guestTmIds)
  const isGuest = (tmId: string) => guests.has(tmId.toLowerCase())
  const [subMatches, setSubMatches] = useSyncedState(initialMatch.subMatches)
  const matchLineup = initialMatch.tournamentLineup ?? null
  const [ecmUrl, setEcmUrl] = useState(initialMatch.ecmUrl ?? null)
  // In playing order
  const stages = sortStages(initialMatch.tournament.stages)
  const [stageId, setStageId] = useState(initialMatch.stage.id)
  const stage = stages.find((st) => st.id === stageId) ?? initialMatch.stage
  const isSeeding = stage.type === "SEEDING"
  const [stageError, setStageError] = useState("")

  async function moveToStage(id: string) {
    setStageError("")
    const res = await fetch(`${BASE_PATH}/api/tournaments/${initialMatch.tournament.id}/matches/${initialMatch.id}/stage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: id }),
    }).catch(() => null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setStageError(data?.error ?? "Verschieben fehlgeschlagen")
      return
    }
    setStageId(id)
    // The stage is part of the match's address
    const data = await res.json().catch(() => null)
    if (matchLineup && data?.slug && data.slug !== initialMatch.slug) {
      router.replace(matchPath(initialMatch.tournament, matchLineup, { id: initialMatch.id, slug: data.slug }))
    }
  }
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(initialMatch.subMatches.map((s) => s.id))
  )

  // CSV import
  const [importDialog, setImportDialog] = useState<{ subMatchId: string } | null>(null)
  const [csvText, setCsvText] = useState("")
  const [importError, setImportError] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [importFileName, setImportFileName] = useState("")
  const [importDragOver, setImportDragOver] = useState(false)

  // Coming from the import page (?ecm=1) the dialog is open right away
  const [showEcmImport, setShowEcmImport] = useState(autoEcmImport && canManage)

  function closeEcmImport() {
    setShowEcmImport(false)
    if (autoEcmImport) window.history.replaceState(null, "", window.location.pathname)
  }

  // Manual round entry
  const [roundEntryId, setRoundEntryId] = useState<string | null>(null)
  const roundEntrySubMatch = subMatches.find((sm) => sm.id === roundEntryId)

  // Sub-matches whose round results are shown (collapsed by default)
  const [roundsOpen, setRoundsOpen] = useState<Set<string>>(new Set())

  function toggleRounds(id: string) {
    setRoundsOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openImport(subMatchId: string) {
    setCsvText("")
    setImportError("")
    setImportFileName("")
    setImportDragOver(false)
    setImportDialog({ subMatchId })
  }

  async function loadImportFile(file: File | undefined) {
    if (!file) return
    setImportError("")
    try {
      setCsvText(await file.text())
      setImportFileName(file.name)
    } catch {
      setImportError("Datei konnte nicht gelesen werden")
    }
  }

  async function handleImport() {
    if (!importDialog) return
    setImportError("")
    setImportLoading(true)
    const res = await fetch(`${BASE_PATH}/api/submatches/${importDialog.subMatchId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    })
    setImportLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setImportError(data.error ?? "Import failed")
      return
    }
    const data = await res.json()
    setSubMatches((sms) =>
      sms.map((sm) =>
        sm.id === importDialog.subMatchId ? { ...sm, rounds: data.rounds } : sm
      )
    )
    setCsvText("")
    setImportDialog(null)
  }

  const matchStats = computeMatchStats(subMatches)

  const matchTitle = isSeeding
    ? "Seeding"
    : [matchLineup?.name, initialMatch.opponent].filter(Boolean).join(" vs ") || "Unknown opponent"

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        {/* Back to the lineup, which in turn leads back to the tournament */}
        <Link
          href={
            matchLineup
              ? lineupPath(initialMatch.tournament, matchLineup)
              : tournamentPath(initialMatch.tournament)
          }
          className="inline-flex flex-wrap items-center gap-x-2 text-sm text-[#9a9090] hover:text-[#f5f0f0] mb-4"
        >
          <ArrowLeft size={14} />
          {initialMatch.tournament.name}
          {matchLineup && (
            <>
              <span className="text-[#5e5858]">/</span>
              {matchLineup.name}
            </>
          )}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-[#f5f0f0]">{matchTitle}</h1>
              {/* A match can be moved between match days and playoffs, but never into or out of the seeding */}
              {canManage && !isSeeding ? (
                <Badge variant="primary" className="relative focus-within:ring-2 focus-within:ring-[#FBD00D]">
                  {stageName(stage, stages)}
                  <ChevronDown size={12} className="ml-1" />
                  <select
                    value={stageId}
                    onChange={(e) => moveToStage(e.target.value)}
                    aria-label="Abschnitt"
                    className="absolute inset-0 w-full cursor-pointer appearance-none rounded-full opacity-0"
                  >
                    {stages.filter((st) => st.type !== "SEEDING").map((st) => (
                      <option key={st.id} value={st.id}>
                        {stageName(st, stages)}
                      </option>
                    ))}
                  </select>
                </Badge>
              ) : (
                <Badge variant="primary">{stageName(stage, stages)}</Badge>
              )}
              <span className="text-xs text-[#5e5858]">
                {formatDay(stageDate(stage, stages, new Date(initialMatch.tournament.startDate ?? initialMatch.tournament.createdAt)))}
              </span>
            </div>
            {stageError && <p className="text-xs text-[#ED1F24]">{stageError}</p>}
            {initialMatch.date && (
              <p className="text-[#9a9090] text-sm">
                {new Date(initialMatch.date).toLocaleDateString("en-GB", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
            {initialMatch.notes && <p className="text-[#5e5858] text-sm mt-1">{initialMatch.notes}</p>}
            {ecmUrl && (
              <a
                href={ecmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-[#9a9090] hover:text-[#FBD00D]"
              >
                <ExternalLink size={12} className="shrink-0" />
                <span className="truncate">{ecmUrl.replace(/^https:\/\//, "")}</span>
              </a>
            )}

            {/* Lineup of this match, fixed when the match is created */}
            {matchLineup && (
              <div className="mt-3">
                <p className="text-xs text-[#9a9090] mb-1.5 flex items-center gap-1.5">
                  <Users size={12} className="text-[#FBD00D]" />
                  {matchLineup.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchLineup.slots.map((slot) => (
                    <span
                      key={slot.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#251f20] border border-[#2d2829] px-2.5 py-1 text-xs text-[#c5bfbf]"
                    >
                      <PlayerAvatar player={slot.player} className="h-4 w-4 text-[9px]" />
                      <PlayerName name={slot.player.name} currentName={slot.player.currentName} />
                      {isGuest(slot.player.tmId) && <GuestBadge />}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {canManage && !isSeeding && (
              <Button size="sm" className="mt-3" onClick={() => setShowEcmImport(true)}>
                <Download size={14} />
                Von eCM importieren
              </Button>
            )}
          </div>
          {matchStats.subMatchesPlayed > 0 && (
            <Card className="shrink-0">
              <CardContent className="py-2 px-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#f5f0f0]">
                    <Wdl won={matchStats.subMatchesWon} drawn={matchStats.subMatchesDrawn} lost={matchStats.subMatchesLost} unit="Sub-Matches" />
                  </p>
                  <p className="text-xs text-[#5e5858]">sub-match score</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Player stats, one table per sub-match */}
      {subMatches.some((sm) => sm.rounds.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-[#9a9090] uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart2 size={14} />
            Stats
          </h2>
          <div className="space-y-4">
            {subMatches.map((sm, idx) =>
              sm.rounds.length > 0 ? <SubMatchStatsTable key={sm.id} sm={sm} number={idx + 1} isGuest={isGuest} /> : null
            )}
          </div>
        </div>
      )}

      {/* Sub-matches */}
      <div className="space-y-3">
        {subMatches.map((sm, idx) => {
          const isOpen = expanded.has(sm.id)
          const stats = computeStats(sm.rounds)
          const totalRounds = sm.rounds.length

          return (
            <div key={sm.id} className="rounded-xl border border-[#2d2829] overflow-hidden">
              {/* Sub-match header */}
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#1c1819] hover:bg-[#211e1f] transition-colors text-left"
                onClick={() => toggleExpanded(sm.id)}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-medium text-[#5e5858] w-5">{idx + 1}.</span>
                  <Badge variant={sm.format === "TIME_ATTACK_10" ? "primary" : "secondary"}>
                    {formatLabel(sm.format)}
                  </Badge>
                  <span className="text-sm text-[#9a9090] max-md:hidden">{formatLabelLong(sm.format)}</span>
                  {sm.rounds[0]?.track && <span className="text-sm text-[#f5f0f0]">{sm.rounds[0].track}</span>}
                  {totalRounds > 0 && (
                    <span className="text-xs text-[#5e5858]">{totalRounds} round{totalRounds !== 1 ? "s" : ""}</span>
                  )}
                  {(stats.ourRoundsWon + stats.ourRoundsLost + stats.ourRoundsDrawn) > 0 && (
                    <Badge variant={stats.ourRoundsWon > stats.ourRoundsLost ? "primary" : stats.ourRoundsWon < stats.ourRoundsLost ? "red" : "default"}>
                      <Wdl won={stats.ourRoundsWon} drawn={stats.ourRoundsDrawn} lost={stats.ourRoundsLost} unit="Runden" />
                    </Badge>
                  )}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-[#5e5858]" /> : <ChevronDown size={16} className="text-[#5e5858]" />}
              </button>

              {/* Sub-match content */}
              {isOpen && (
                <div className="border-t border-[#2d2829] p-4 space-y-4 bg-[#0e0c0d]">
                  {/* Summary */}
                  {totalRounds > 0 && (
                    <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-[#2d2829] bg-[#1c1819] px-5 py-3 text-sm">
                      <div>
                        <p className="text-xs text-[#9a9090]">Rounds</p>
                        <p className="text-[#f5f0f0] font-medium">{totalRounds}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9a9090]">Our rounds won</p>
                        <p className="text-[#f5f0f0] font-medium">{stats.ourRoundsWon} / {totalRounds}</p>
                      </div>
                      {stats.bestOurTime && (
                        <div>
                          <p className="text-xs text-[#9a9090]">Our best time</p>
                          <p className="text-[#FBD00D] font-mono font-medium">{formatTime(stats.bestOurTime)}</p>
                        </div>
                      )}
                      {stats.bestOpponentTime && (
                        <div>
                          <p className="text-xs text-[#9a9090]">Opponent best</p>
                          <p className="text-[#c5bfbf] font-mono">{formatTime(stats.bestOpponentTime)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Import button */}
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      {teamSize(sm.format) != null && (
                        <Button variant="outline" size="sm" onClick={() => setRoundEntryId(sm.id)}>
                          <Grid3x3 size={14} />
                          Runden eintippen
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openImport(sm.id)}>
                        <Upload size={14} />
                        Import CSV
                      </Button>
                    </div>
                  )}

                  {/* Rounds */}
                  {totalRounds > 0 && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        aria-expanded={roundsOpen.has(sm.id)}
                        onClick={() => toggleRounds(sm.id)}
                        className="w-full flex items-center justify-between rounded-lg border border-[#2d2829] bg-[#1c1819] px-4 py-2.5 text-left hover:bg-[#211e1f] transition-colors"
                      >
                        <span className="text-xs font-semibold text-[#9a9090] uppercase tracking-wider">
                          Round Results
                          <span className="ml-2 font-normal normal-case tracking-normal text-[#5e5858]">
                            {totalRounds} round{totalRounds !== 1 ? "s" : ""}
                          </span>
                        </span>
                        {roundsOpen.has(sm.id) ? <ChevronUp size={16} className="text-[#5e5858]" /> : <ChevronDown size={16} className="text-[#5e5858]" />}
                      </button>
                      {roundsOpen.has(sm.id) && sm.rounds.map((round) => {
                        const ourResults = round.results.filter((r) => r.isOurTeam)
                        const oppResults = round.results.filter((r) => !r.isOurTeam)
                        const placements = roundPlacements(round.results)
                        const rankMap = new Map(round.results.map((r, idx) => [r.id, placements[idx]]))
                        const score = roundScore(round.results)

                        return (
                          <Card key={round.id} className={score?.outcome === "W" ? "border-[#FBD00D]/30" : ""}>
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-3 mb-3">
                                <Badge variant="default">Round {round.number + 1}</Badge>
                                {round.track && <span className="text-xs text-[#5e5858]">{round.track}</span>}
                                {score?.outcome === "W" && <Badge variant="primary">WIN</Badge>}
                                {score?.outcome === "L" && <Badge variant="red">LOSS</Badge>}
                                {score?.outcome === "D" && <Badge variant="default">DRAW</Badge>}
                                {score && <span className="text-xs font-mono text-[#9a9090]" title="Punkte: wir – Gegner">{score.ours}–{score.theirs}</span>}
                              </div>
                              {/* Phones: one list in finishing order, our players highlighted */}
                              <ol className="space-y-1 md:hidden">
                                {round.results.map((r) => {
                                  const rank = rankMap.get(r.id) ?? 0
                                  return (
                                    <li
                                      key={r.id}
                                      className={cn(
                                        "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                                        r.isOurTeam ? "bg-[#FBD00D]/10 text-[#f5f0f0]" : "text-[#9a9090]"
                                      )}
                                    >
                                      <span className={`w-6 shrink-0 text-xs font-bold font-mono ${rankColor(rank)}`}>#{rank}</span>
                                      <span className="min-w-0 flex-1 truncate">
                                        {r.isOurTeam ? <PlayerName name={r.playerName} currentName={r.currentName} /> : r.playerName}
                                        {r.isOurTeam && isGuest(r.tmId) && <GuestBadge className="ml-1.5" />}
                                      </span>
                                      <span className={`shrink-0 font-mono text-xs ${rankColor(rank)}`}>
                                        {r.dnf ? "DNF" : r.timeMs != null ? formatTime(r.timeMs) : "—"}
                                      </span>
                                    </li>
                                  )
                                })}
                              </ol>
                              <div className="hidden grid-cols-2 gap-4 md:grid">
                                <div>
                                  <p className="text-xs text-[#FBD00D] font-medium mb-2 flex items-center gap-1">
                                    <Trophy size={10} />
                                    Our team
                                  </p>
                                  <div className="space-y-1">
                                    {ourResults.map((r) => {
                                      const rank = rankMap.get(r.id) ?? 0
                                      return (
                                        <div key={r.id} className="flex items-center gap-2 text-sm">
                                          <span className={`w-5 shrink-0 text-xs font-bold font-mono ${rankColor(rank)}`}>
                                            #{rank}
                                          </span>
                                          <span className="text-[#f5f0f0] flex-1 truncate">
                                            <PlayerName name={r.playerName} currentName={r.currentName} />
                                            {isGuest(r.tmId) && <GuestBadge className="ml-1.5" />}
                                          </span>
                                          <span className={`font-mono shrink-0 ${rankColor(rank)}`}>
                                            {r.dnf ? "DNF" : r.timeMs != null ? formatTime(r.timeMs) : "—"}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-[#5e5858] font-medium mb-2">Opponent</p>
                                  <div className="space-y-1">
                                    {oppResults.map((r) => {
                                      const rank = rankMap.get(r.id) ?? 0
                                      return (
                                        <div key={r.id} className="flex items-center gap-2 text-sm">
                                          <span className={`w-5 shrink-0 text-xs font-bold font-mono ${rankColor(rank)}`}>
                                            #{rank}
                                          </span>
                                          <span className="text-[#9a9090] flex-1 truncate">{r.playerName}</span>
                                          <span className={`font-mono shrink-0 ${rankColor(rank)}`}>
                                            {r.dnf ? "DNF" : r.timeMs != null ? formatTime(r.timeMs) : "—"}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}

                  {totalRounds === 0 && (
                    <div className="py-6 text-center">
                      <Clock size={24} className="mx-auto text-[#5e5858] mb-2" />
                      <p className="text-[#9a9090] text-xs">No results yet. Enter rounds manually or import a CSV.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* eCircuitMania import dialog */}
      {showEcmImport && (
        <EcmImportDialog
          subMatches={subMatches}
          allPlayers={allPlayers}
          startDay={dayKey(initialMatch.tournament.startDate ?? initialMatch.tournament.createdAt)}
          isGuest={isGuest}
          onClose={closeEcmImport}
          onImported={(subMatchId, rounds, url) => {
            setSubMatches((sms) => sms.map((sm) => (sm.id === subMatchId ? { ...sm, rounds } : sm)))
            if (url) setEcmUrl(url)
          }}
        />
      )}

      {/* Manual round entry dialog */}
      {roundEntrySubMatch && (
        <RoundEntryDialog
          key={roundEntrySubMatch.id}
          subMatch={roundEntrySubMatch}
          pool={(roundEntrySubMatch.lineup ?? matchLineup)?.slots.map((s) => s.player) ?? []}
          allPlayers={allPlayers}
          isGuest={isGuest}
          onClose={() => setRoundEntryId(null)}
          onSaved={(rounds) => {
            setSubMatches((sms) => sms.map((sm) => (sm.id === roundEntrySubMatch.id ? { ...sm, rounds } : sm)))
            setRoundEntryId(null)
          }}
        />
      )}

      {/* CSV import dialog */}
      <Dialog open={!!importDialog} onClose={() => setImportDialog(null)} className="max-w-2xl">
        <DialogTitle>
          Import CSV Results
          {importDialog && (
            <span className="ml-2 text-sm font-normal text-[#9a9090]">
              — {formatLabelLong(subMatches.find((sm) => sm.id === importDialog.subMatchId)?.format ?? "ROUND_1V1")}
            </span>
          )}
        </DialogTitle>
        <div className="space-y-3">
          <p className="text-xs text-[#9a9090]">
            Paste CSV with columns: Time, Track, PlayerID, PlayerName, Record, RoundNumber
          </p>
          <label
            onDragOver={(e) => { e.preventDefault(); setImportDragOver(true) }}
            onDragLeave={() => setImportDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setImportDragOver(false)
              loadImportFile(e.dataTransfer.files[0])
            }}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${
              importDragOver
                ? "border-[#FBD00D] bg-[#FBD00D]/10"
                : "border-[#3a3435] hover:border-[#5e5858] hover:bg-[#251f20]"
            }`}
          >
            <Upload size={18} className={importDragOver ? "text-[#FBD00D]" : "text-[#9a9090]"} />
            <span className="text-sm text-[#f5f0f0]">
              {importFileName || "CSV-Datei hierher ziehen oder klicken zum Auswählen"}
            </span>
            <span className="text-xs text-[#5e5858]">
              {importFileName ? "Andere Datei wählen" : "oder den Inhalt unten einfügen"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                loadImportFile(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </label>
          <Textarea
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setImportFileName("") }}
            rows={10}
            className="font-mono text-xs"
            placeholder={"Time,Track,PlayerID,PlayerName,Record,RoundNumber\n1739732697,SMS - Origin,15b02a29-...,Tommy.TM,61167,0\n..."}
          />
          {importError && <p className="text-sm text-[#ED1F24]">{importError}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setImportDialog(null); setCsvText("") }}>Cancel</Button>
            <Button onClick={handleImport} disabled={!csvText.trim() || importLoading}>
              {importLoading ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function rankColor(rank: number): string {
  if (rank === 1) return "text-[#FBD00D]"
  if (rank === 2) return "text-[#c5bfbf]"
  if (rank === 3) return "text-[#cd7f32]"
  return "text-[#5e5858]"
}

function computeStats(rounds: Round[]) {
  let ourRoundsWon = 0
  let ourRoundsLost = 0
  let ourRoundsDrawn = 0
  let bestOurTime: number | undefined
  let bestOpponentTime: number | undefined

  for (const round of rounds) {
    const outcome = roundScore(round.results)?.outcome
    if (outcome === "W") ourRoundsWon++
    else if (outcome === "L") ourRoundsLost++
    else if (outcome === "D") ourRoundsDrawn++

    const ourBest = round.results.filter((r) => r.isOurTeam)[0]?.timeMs ?? undefined
    const oppBest = round.results.filter((r) => !r.isOurTeam)[0]?.timeMs ?? undefined
    if (ourBest !== undefined && (bestOurTime === undefined || ourBest < bestOurTime)) bestOurTime = ourBest
    if (oppBest !== undefined && (bestOpponentTime === undefined || oppBest < bestOpponentTime)) bestOpponentTime = oppBest
  }

  return { ourRoundsWon, ourRoundsLost, ourRoundsDrawn, bestOurTime, bestOpponentTime }
}

function computeMatchStats(subMatches: SubMatch[]) {
  let subMatchesWon = 0
  let subMatchesLost = 0
  let subMatchesDrawn = 0
  let subMatchesPlayed = 0

  for (const sm of subMatches) {
    if (sm.rounds.length === 0) continue
    const stats = computeStats(sm.rounds)
    if (stats.ourRoundsWon + stats.ourRoundsLost + stats.ourRoundsDrawn === 0) continue
    subMatchesPlayed++
    if (stats.ourRoundsWon > stats.ourRoundsLost) subMatchesWon++
    else if (stats.ourRoundsLost > stats.ourRoundsWon) subMatchesLost++
    else subMatchesDrawn++
  }

  return { subMatchesWon, subMatchesLost, subMatchesDrawn, subMatchesPlayed }
}
