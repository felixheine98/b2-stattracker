"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatLabel, formatLabelLong, formatTime, teamSize } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { ArrowLeft, ChevronDown, ChevronUp, Clock, Download, Grid3x3, Trophy, Upload, Users } from "lucide-react"
import Link from "next/link"
import { useSyncedState } from "@/lib/use-synced-state"
import { PlayerAvatar } from "@/components/player-avatar"
import { GuestBadge } from "@/components/guest-badge"
import { useMemo, useState } from "react"
import { EcmImportDialog } from "./ecm-import-dialog"
import { RoundEntryDialog } from "./round-entry-dialog"

export interface Player {
  id: string
  tmId: string
  name: string
  country?: string | null
}

interface RoundResult {
  id: string
  tmId: string
  playerName: string
  timeMs: number | null
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
  name: string
  slots: Array<{ id: string; player: Player }>
}

interface Match {
  id: string
  isSeeding: boolean
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  tournamentLineup?: TournamentLineup | null
  tournament: {
    id: string
    name: string
    formats: Format[]
    tournamentLineups: TournamentLineup[]
  }
  subMatches: SubMatch[]
}

type SortCol = "name" | "played" | "placementSum" | "avg" | "roundW" | "roundL" | "bestTime" | "medianTime" | "avgTime"

function SubMatchStatsTable({ sm, isGuest }: { sm: SubMatch; isGuest: (tmId: string) => boolean }) {
  const [sortCol, setSortCol] = useState<SortCol>("avg")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const teamStats = useMemo(() => computeStats(sm.rounds), [sm.rounds])

  const rows = useMemo(() => {
    const playerMap = new Map<string, { id: string | null; tmId: string; name: string }>()
    for (const round of sm.rounds) {
      for (const r of round.results) {
        if (r.isOurTeam && !playerMap.has(r.tmId)) {
          playerMap.set(r.tmId, { id: r.playerId ?? null, tmId: r.tmId, name: r.playerName })
        }
      }
    }
    return Array.from(playerMap.values()).map((p) => {
      let roundsPlayed = 0
      let placementSum = 0
      const times: number[] = []
      for (const round of sm.rounds) {
        const result = round.results.find(
          (r) => r.isOurTeam && ((p.id && r.playerId === p.id) || r.tmId === p.tmId)
        )
        if (!result) continue
        roundsPlayed++
        placementSum += round.results.findIndex((r) => r.id === result.id) + 1
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
        roundsPlayed,
        placementSum,
        avg: roundsPlayed > 0 ? placementSum / roundsPlayed : 0,
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
      else if (sortCol === "roundW") cmp = teamStats.ourRoundsWon - teamStats.ourRoundsWon
      else if (sortCol === "roundL") cmp = teamStats.ourRoundsLost - teamStats.ourRoundsLost
      else if (sortCol === "bestTime") cmp = (a.bestTime ?? Infinity) - (b.bestTime ?? Infinity)
      else if (sortCol === "medianTime") cmp = (a.medianTime ?? Infinity) - (b.medianTime ?? Infinity)
      else if (sortCol === "avgTime") cmp = (a.avgTime ?? Infinity) - (b.avgTime ?? Infinity)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir, teamStats])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortCol(col); setSortDir("asc") }
  }

  const mapOutcome = sm.rounds.length === 0 ? null
    : teamStats.ourRoundsWon > teamStats.ourRoundsLost ? "W"
    : teamStats.ourRoundsLost > teamStats.ourRoundsWon ? "L" : "D"
  const mapColor = mapOutcome === "W" ? "text-[#FBD00D]" : mapOutcome === "L" ? "text-[#ED1F24]" : "text-[#9a9090]"

  function Th({ col, label, left }: { col: SortCol; label: string; left?: boolean }) {
    const active = sortCol === col
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`py-1.5 px-2 font-medium cursor-pointer select-none whitespace-nowrap group ${left ? "text-left pl-0 pr-4" : "text-right"}`}
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
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2d2829]">
            <Th col="name" label="Spieler" left />
            <Th col="played" label="Gespielt" />
            <Th col="placementSum" label="Platzsumme" />
            <Th col="avg" label="Ø Platz" />
            <th className="py-1.5 px-2 text-right text-[#5e5858] font-medium whitespace-nowrap">Round W</th>
            <th className="py-1.5 px-2 text-right text-[#5e5858] font-medium whitespace-nowrap">Round L</th>
            <Th col="bestTime" label="Beste Zeit" />
            <Th col="medianTime" label="Median Zeit" />
            <Th col="avgTime" label="Ø Zeit" />
            <th className="py-1.5 pl-2 text-right text-[#5e5858] font-medium">Map</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} className="py-3 text-center text-[#5e5858]">Noch keine Daten</td>
            </tr>
          )}
          {sorted.map((row) => (
            <tr key={row.tmId} className="border-b border-[#1c1819] hover:bg-[#1c1819]/50">
              <td className="py-1.5 pr-4 text-[#f5f0f0] font-medium whitespace-nowrap">
                {row.name}
                {isGuest(row.tmId) && <GuestBadge className="ml-1.5" />}
              </td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf]">{row.roundsPlayed}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf]">{row.placementSum}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf] font-mono">
                {row.avg > 0 ? row.avg.toFixed(3) : "—"}
              </td>
              <td className="py-1.5 px-2 text-right text-[#f5f0f0]">{sm.rounds.length > 0 ? teamStats.ourRoundsWon : "—"}</td>
              <td className="py-1.5 px-2 text-right text-[#f5f0f0]">{sm.rounds.length > 0 ? teamStats.ourRoundsLost : "—"}</td>
              <td className="py-1.5 px-2 text-right text-[#FBD00D] font-mono">{row.bestTime != null ? formatTime(row.bestTime) : "—"}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf] font-mono">{row.medianTime != null ? formatTime(Math.round(row.medianTime)) : "—"}</td>
              <td className="py-1.5 px-2 text-right text-[#c5bfbf] font-mono">{row.avgTime != null ? formatTime(Math.round(row.avgTime)) : "—"}</td>
              <td className={`py-1.5 pl-2 text-right font-bold ${mapColor}`}>{mapOutcome ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Props {
  match: Match
  allPlayers: Player[]
  // Lower-cased TM IDs of players who are guests in this tournament
  guestTmIds: string[]
  canManage: boolean
}

export function MatchDetailView({ match: initialMatch, allPlayers, guestTmIds, canManage }: Props) {
  const guests = new Set(guestTmIds)
  const isGuest = (tmId: string) => guests.has(tmId.toLowerCase())
  const [subMatches, setSubMatches] = useSyncedState(initialMatch.subMatches)
  const matchLineup = initialMatch.tournamentLineup ?? null
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

  const [showEcmImport, setShowEcmImport] = useState(false)

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
    const res = await fetch(`/b2-stats/api/submatches/${importDialog.subMatchId}/import`, {
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

  const matchTitle = initialMatch.isSeeding
    ? "Seeding"
    : [matchLineup?.name, initialMatch.opponent].filter(Boolean).join(" vs ") || "Unknown opponent"

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          href={`/tournaments/${initialMatch.tournament.id}`}
          className="inline-flex items-center gap-1 text-sm text-[#9a9090] hover:text-[#f5f0f0] mb-4"
        >
          <ArrowLeft size={14} />
          {initialMatch.tournament.name}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-[#f5f0f0]">{matchTitle}</h1>
              {initialMatch.isSeeding && <Badge variant="primary">Seeding</Badge>}
            </div>
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
                      {slot.player.name}
                      {isGuest(slot.player.tmId) && <GuestBadge />}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {canManage && !initialMatch.isSeeding && (
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
                    {matchStats.subMatchesWon}–{matchStats.subMatchesLost}{matchStats.subMatchesDrawn > 0 ? `–${matchStats.subMatchesDrawn}` : ""}
                  </p>
                  <p className="text-xs text-[#5e5858]">sub-match score</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
                className="w-full flex items-center justify-between px-4 py-3 bg-[#1c1819] hover:bg-[#211e1f] transition-colors text-left"
                onClick={() => toggleExpanded(sm.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#5e5858] w-5">{idx + 1}.</span>
                  <Badge variant={sm.format === "TIME_ATTACK_10" ? "primary" : "secondary"}>
                    {formatLabel(sm.format)}
                  </Badge>
                  <span className="text-sm text-[#9a9090]">{formatLabelLong(sm.format)}</span>
                  {sm.rounds[0]?.track && <span className="text-sm text-[#f5f0f0]">{sm.rounds[0].track}</span>}
                  {totalRounds > 0 && (
                    <span className="text-xs text-[#5e5858]">{totalRounds} round{totalRounds !== 1 ? "s" : ""}</span>
                  )}
                  {(stats.ourRoundsWon + stats.ourRoundsLost + stats.ourRoundsDrawn) > 0 && (
                    <Badge variant={stats.ourRoundsWon > stats.ourRoundsLost ? "primary" : stats.ourRoundsWon < stats.ourRoundsLost ? "red" : "default"}>
                      {stats.ourRoundsWon}–{stats.ourRoundsLost}{stats.ourRoundsDrawn > 0 ? `–${stats.ourRoundsDrawn}` : ""}
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

                  {/* Player stats table */}
                  <SubMatchStatsTable sm={sm} isGuest={isGuest} />

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
                        const rankMap = new Map(round.results.map((r, idx) => [r.id, idx + 1]))
                        const outcome = computeRoundOutcome(round.results)

                        return (
                          <Card key={round.id} className={outcome === "win" ? "border-[#FBD00D]/30" : ""}>
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-3 mb-3">
                                <Badge variant="default">Round {round.number + 1}</Badge>
                                {round.track && <span className="text-xs text-[#5e5858]">{round.track}</span>}
                                {outcome === "win" && <Badge variant="primary">WIN</Badge>}
                                {outcome === "loss" && <Badge variant="red">LOSS</Badge>}
                                {outcome === "draw" && <Badge variant="default">DRAW</Badge>}
                              </div>
                              <div className="grid grid-cols-2 gap-4">
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
                                            {r.playerName}
                                            {isGuest(r.tmId) && <GuestBadge className="ml-1.5" />}
                                          </span>
                                          <span className={`font-mono shrink-0 ${rankColor(rank)}`}>
                                            {r.timeMs != null ? formatTime(r.timeMs) : "—"}
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
                                            {r.timeMs != null ? formatTime(r.timeMs) : "—"}
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
          isGuest={isGuest}
          onClose={() => setShowEcmImport(false)}
          onImported={(subMatchId, rounds) =>
            setSubMatches((sms) => sms.map((sm) => (sm.id === subMatchId ? { ...sm, rounds } : sm)))
          }
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
          <div className="flex gap-2 justify-end">
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

function computeRoundOutcome(results: RoundResult[]): "win" | "loss" | "draw" | null {
  const n = results.length
  if (n === 0) return null
  const ourResults = results.filter((r) => r.isOurTeam)
  const oppResults = results.filter((r) => !r.isOurTeam)
  if (ourResults.length === 0 || oppResults.length === 0) return null
  const rankMap = new Map(results.map((r, idx) => [r.id, idx + 1]))
  const ourPoints = ourResults.reduce((sum, r) => sum + (n - (rankMap.get(r.id) ?? n) + 1), 0)
  const total = (n * (n + 1)) / 2
  if (ourPoints * 2 > total) return "win"
  if (ourPoints * 2 < total) return "loss"
  return "draw"
}

function computeStats(rounds: Round[]) {
  let ourRoundsWon = 0
  let ourRoundsLost = 0
  let ourRoundsDrawn = 0
  let bestOurTime: number | undefined
  let bestOpponentTime: number | undefined

  for (const round of rounds) {
    const outcome = computeRoundOutcome(round.results)
    if (outcome === "win") ourRoundsWon++
    else if (outcome === "loss") ourRoundsLost++
    else if (outcome === "draw") ourRoundsDrawn++

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
