"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Upload, Users, Clock, Trophy, ChevronDown, ChevronUp } from "lucide-react"
import { formatLabel, formatLabelLong, formatTime } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface Player {
  id: string
  tmId: string
  name: string
}

interface RoundResult {
  id: string
  tmId: string
  playerName: string
  timeMs: number
  isOurTeam: boolean
  playerId?: string | null
  player?: { id: string; name: string } | null
}

interface Round {
  id: string
  number: number
  track?: string | null
  results: RoundResult[]
}

interface Lineup {
  id: string
  slots: Array<{ id: string; player: Player }>
}

interface SubMatch {
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
  tournament: {
    id: string
    name: string
    formats: Format[]
    tournamentLineups: TournamentLineup[]
  }
  subMatches: SubMatch[]
}

interface Props {
  match: Match
  allPlayers: Player[]
  canManage: boolean
}

export function MatchDetailView({ match: initialMatch, allPlayers, canManage }: Props) {
  const [subMatches, setSubMatches] = useState(initialMatch.subMatches)
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(initialMatch.subMatches.map((s) => s.id))
  )

  const [lineupEditor, setLineupEditor] = useState<{ subMatchId: string; selectedIds: string[] } | null>(null)
  const [lineupLoading, setLineupLoading] = useState(false)

  const [importDialog, setImportDialog] = useState<{ subMatchId: string } | null>(null)
  const [csvText, setCsvText] = useState("")
  const [importError, setImportError] = useState("")
  const [importLoading, setImportLoading] = useState(false)

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openLineupEditor(sm: SubMatch) {
    setLineupEditor({ subMatchId: sm.id, selectedIds: sm.lineup?.slots.map((s) => s.player.id) ?? [] })
  }

  async function saveLineup() {
    if (!lineupEditor) return
    setLineupLoading(true)
    const res = await fetch(`/b2-stats/api/submatches/${lineupEditor.subMatchId}/lineup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: lineupEditor.selectedIds }),
    })
    setLineupLoading(false)
    if (!res.ok) return
    const data = await res.json()
    setSubMatches((sms) =>
      sms.map((sm) => (sm.id === lineupEditor.subMatchId ? { ...sm, lineup: data } : sm))
    )
    setLineupEditor(null)
  }

  function openImport(subMatchId: string) {
    setCsvText("")
    setImportError("")
    setImportDialog({ subMatchId })
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
              <h1 className="text-2xl font-bold text-[#f5f0f0]">
                {initialMatch.isSeeding ? "Seeding" : `vs. ${initialMatch.opponent ?? "Unknown"}`}
              </h1>
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
                  <div className="grid grid-cols-2 gap-4">
                    {/* Lineup */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Lineup</CardTitle>
                          {canManage && (
                            <Button variant="outline" size="sm" onClick={() => openLineupEditor(sm)}>
                              <Users size={14} />
                              Edit
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {!sm.lineup || sm.lineup.slots.length === 0 ? (
                          <p className="text-[#9a9090] text-sm">No lineup set.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {sm.lineup.slots.map((slot) => (
                              <div key={slot.id} className="flex items-center gap-2 text-sm">
                                <div className="h-6 w-6 rounded-full bg-[#FBD00D]/15 flex items-center justify-center text-[#FBD00D] text-xs font-bold shrink-0">
                                  {slot.player.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[#f5f0f0]">{slot.player.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Stats */}
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
                      <CardContent>
                        {totalRounds === 0 ? (
                          <p className="text-[#9a9090] text-sm">No results yet.</p>
                        ) : (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-[#9a9090]">Rounds</span>
                              <span className="text-[#f5f0f0] font-medium">{totalRounds}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#9a9090]">Our rounds won</span>
                              <span className="text-[#f5f0f0] font-medium">
                                {stats.ourRoundsWon} / {totalRounds}
                              </span>
                            </div>
                            {stats.bestOurTime && (
                              <div className="flex justify-between">
                                <span className="text-[#9a9090]">Our best time</span>
                                <span className="text-[#FBD00D] font-mono font-medium">{formatTime(stats.bestOurTime)}</span>
                              </div>
                            )}
                            {stats.bestOpponentTime && (
                              <div className="flex justify-between">
                                <span className="text-[#9a9090]">Opponent best</span>
                                <span className="text-[#c5bfbf] font-mono">{formatTime(stats.bestOpponentTime)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Import button */}
                  {canManage && (
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => openImport(sm.id)}>
                        <Upload size={14} />
                        Import CSV
                      </Button>
                    </div>
                  )}

                  {/* Rounds */}
                  {totalRounds > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-[#9a9090] uppercase tracking-wider">Round Results</h3>
                      {sm.rounds.map((round) => {
                        const ourResults = round.results.filter((r) => r.isOurTeam)
                        const oppResults = round.results.filter((r) => !r.isOurTeam)
                        // Overall rank across all players in this round (results already sorted by timeMs asc)
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
                                          <span className="text-[#f5f0f0] flex-1 truncate">{r.playerName}</span>
                                          <span className={`font-mono shrink-0 ${rankColor(rank)}`}>
                                            {formatTime(r.timeMs)}
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
                                            {formatTime(r.timeMs)}
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
                      <p className="text-[#9a9090] text-xs">No results yet. Import a CSV to add round data.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lineup editor dialog */}
      <Dialog open={!!lineupEditor} onClose={() => setLineupEditor(null)}>
        <DialogTitle>
          Edit Lineup
          {lineupEditor && (
            <span className="ml-2 text-sm font-normal text-[#9a9090]">
              — {formatLabelLong(subMatches.find((sm) => sm.id === lineupEditor.subMatchId)?.format ?? "ROUND_1V1")}
            </span>
          )}
        </DialogTitle>
        {initialMatch.tournament.tournamentLineups.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <p className="text-xs text-[#5e5858]">Load from preset lineup:</p>
            <div className="flex flex-wrap gap-1.5">
              {initialMatch.tournament.tournamentLineups.map((tl) => (
                <button
                  key={tl.id}
                  type="button"
                  onClick={() =>
                    setLineupEditor((prev) =>
                      prev ? { ...prev, selectedIds: tl.slots.map((s) => s.player.id) } : null
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-[#2d2829] bg-[#1c1819] px-2.5 py-1 text-xs text-[#9a9090] hover:border-[#FBD00D]/40 hover:text-[#f5f0f0] transition-colors"
                >
                  <Users size={10} />
                  {tl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
          {allPlayers.map((p) => {
            const selected = lineupEditor?.selectedIds.includes(p.id) ?? false
            return (
              <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    setLineupEditor((prev) =>
                      prev
                        ? {
                            ...prev,
                            selectedIds: selected
                              ? prev.selectedIds.filter((id) => id !== p.id)
                              : [...prev.selectedIds, p.id],
                          }
                        : null
                    )
                  }
                  className="h-4 w-4 accent-[#FBD00D]"
                />
                <span className="text-sm text-[#f5f0f0] group-hover:text-white">{p.name}</span>
                <span className="text-xs text-[#5e5858] font-mono">{p.tmId.slice(0, 8)}…</span>
              </label>
            )
          })}
          {allPlayers.length === 0 && (
            <p className="text-[#9a9090] text-sm">
              No players registered.{" "}
              <Link href="/players" className="text-[#FBD00D] hover:underline">Add players first.</Link>
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setLineupEditor(null)}>Cancel</Button>
          <Button onClick={saveLineup} disabled={lineupLoading}>
            {lineupLoading ? "Saving…" : "Save Lineup"}
          </Button>
        </div>
      </Dialog>

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
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
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
  // rank 1 = n pts, rank 2 = n-1 pts, ..., rank n = 1 pt
  // results are sorted by timeMs asc so index = rank-1
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

    const ourBest = round.results.filter((r) => r.isOurTeam)[0]?.timeMs
    const oppBest = round.results.filter((r) => !r.isOurTeam)[0]?.timeMs
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
