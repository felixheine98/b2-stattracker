"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Upload, Users, Clock, Trophy } from "lucide-react"
import { formatLabel, formatTime } from "@/lib/utils"
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

interface Match {
  id: string
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  tournament: { id: string; name: string; format: Format }
  lineup?: Lineup | null
  rounds: Round[]
}

interface Props {
  match: Match
  allPlayers: Player[]
}

export function MatchDetailView({ match: initialMatch, allPlayers }: Props) {
  const [match, setMatch] = useState(initialMatch)
  const [showLineupEditor, setShowLineupEditor] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText] = useState("")
  const [importError, setImportError] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [lineupLoading, setLineupLoading] = useState(false)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    match.lineup?.slots.map((s) => s.player.id) ?? []
  )

  async function saveLineup() {
    setLineupLoading(true)
    const res = await fetch(
      `/api/tournaments/${match.tournament.id}/matches/${match.id}/lineup`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: selectedPlayerIds }),
      }
    )
    setLineupLoading(false)
    if (!res.ok) return
    const data = await res.json()
    setMatch((m) => ({ ...m, lineup: data }))
    setShowLineupEditor(false)
  }

  async function handleImport() {
    setImportError("")
    setImportLoading(true)
    const res = await fetch(
      `/api/tournaments/${match.tournament.id}/matches/${match.id}/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      }
    )
    setImportLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setImportError(data.error ?? "Import failed")
      return
    }
    const data = await res.json()
    setMatch((m) => ({ ...m, rounds: data.rounds }))
    setCsvText("")
    setShowImport(false)
  }

  const ourPlayers = match.lineup?.slots.map((s) => s.player) ?? []

  const stats = computeStats(match.rounds)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href={`/tournaments/${match.tournament.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-4"
        >
          <ArrowLeft size={14} />
          {match.tournament.name}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-100">
                vs. {match.opponent ?? "Unknown"}
              </h1>
              <Badge variant={match.tournament.format.startsWith("TIME") ? "cyan" : "purple"}>
                {formatLabel(match.tournament.format)}
              </Badge>
            </div>
            {match.date && (
              <p className="text-slate-400 text-sm">
                {new Date(match.date).toLocaleDateString("en-GB", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
            {match.notes && <p className="text-slate-500 text-sm mt-1">{match.notes}</p>}
          </div>
          <Button onClick={() => setShowImport(true)}>
            <Upload size={16} />
            Import CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lineup</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedPlayerIds(match.lineup?.slots.map((s) => s.player.id) ?? [])
                setShowLineupEditor(true)
              }}>
                <Users size={14} />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ourPlayers.length === 0 ? (
              <p className="text-slate-500 text-sm">No lineup set yet.</p>
            ) : (
              <div className="space-y-1.5">
                {ourPlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <div className="h-6 w-6 rounded-full bg-cyan-900 flex items-center justify-center text-cyan-300 text-xs font-bold shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-200">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Rounds</span>
                <span className="text-slate-100 font-medium">{match.rounds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Our rounds won</span>
                <span className="text-slate-100 font-medium">
                  {stats.ourRoundsWon} / {match.rounds.length}
                </span>
              </div>
              {stats.bestOurTime && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Our best time</span>
                  <span className="text-cyan-300 font-mono font-medium">{formatTime(stats.bestOurTime)}</span>
                </div>
              )}
              {stats.bestOpponentTime && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Opponent best</span>
                  <span className="text-slate-300 font-mono">{formatTime(stats.bestOpponentTime)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {match.rounds.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Round Results
          </h2>
          <div className="space-y-3">
            {match.rounds.map((round) => {
              const ourResults = round.results.filter((r) => r.isOurTeam)
              const oppResults = round.results.filter((r) => !r.isOurTeam)
              const ourBest = ourResults[0]?.timeMs
              const oppBest = oppResults[0]?.timeMs
              const weWon = ourBest !== undefined && oppBest !== undefined && ourBest < oppBest

              return (
                <Card key={round.id} className={weWon ? "border-cyan-800" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="default">Round {round.number + 1}</Badge>
                      {round.track && <span className="text-xs text-slate-500">{round.track}</span>}
                      {ourBest !== undefined && oppBest !== undefined && (
                        <Badge variant={weWon ? "cyan" : "red"}>{weWon ? "WIN" : "LOSS"}</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-cyan-400 font-medium mb-2 flex items-center gap-1">
                          <Trophy size={10} />
                          Our team
                        </p>
                        <div className="space-y-1">
                          {ourResults.map((r, i) => (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-200">{r.playerName}</span>
                              <span className={`font-mono ${i === 0 ? "text-cyan-300 font-semibold" : "text-slate-400"}`}>
                                {formatTime(r.timeMs)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-2">Opponent</p>
                        <div className="space-y-1">
                          {oppResults.map((r, i) => (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">{r.playerName}</span>
                              <span className={`font-mono ${i === 0 ? "text-slate-300" : "text-slate-500"}`}>
                                {formatTime(r.timeMs)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {match.rounds.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Clock size={28} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm">No results yet. Import a CSV to add round data.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowImport(true)}>
              <Upload size={14} />
              Import CSV
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showLineupEditor} onClose={() => setShowLineupEditor(false)}>
        <DialogTitle>Edit Lineup</DialogTitle>
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
          {allPlayers.map((p) => {
            const selected = selectedPlayerIds.includes(p.id)
            return (
              <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    setSelectedPlayerIds((ids) =>
                      selected ? ids.filter((id) => id !== p.id) : [...ids, p.id]
                    )
                  }
                  className="h-4 w-4 accent-cyan-500"
                />
                <span className="text-sm text-slate-200 group-hover:text-slate-100">{p.name}</span>
                <span className="text-xs text-slate-600 font-mono">{p.tmId.slice(0, 8)}…</span>
              </label>
            )
          })}
          {allPlayers.length === 0 && (
            <p className="text-slate-500 text-sm">
              No players registered.{" "}
              <Link href="/players" className="text-cyan-400 hover:underline">Add players first.</Link>
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setShowLineupEditor(false)}>Cancel</Button>
          <Button onClick={saveLineup} disabled={lineupLoading}>
            {lineupLoading ? "Saving…" : "Save Lineup"}
          </Button>
        </div>
      </Dialog>

      <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-2xl">
        <DialogTitle>Import CSV Results</DialogTitle>
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Paste CSV with columns: Time, Track, PlayerID, PlayerName, Record, RoundNumber
          </p>
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder={"Time,Track,PlayerID,PlayerName,Record,RoundNumber\n1739732697,SMS - Origin,15b02a29-...,Tommy.TM,61167,0\n..."}
          />
          {importError && <p className="text-sm text-red-400">{importError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setShowImport(false); setCsvText("") }}>Cancel</Button>
            <Button onClick={handleImport} disabled={!csvText.trim() || importLoading}>
              {importLoading ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function computeStats(rounds: Round[]) {
  let ourRoundsWon = 0
  let bestOurTime: number | undefined
  let bestOpponentTime: number | undefined

  for (const round of rounds) {
    const ourResults = round.results.filter((r) => r.isOurTeam)
    const oppResults = round.results.filter((r) => !r.isOurTeam)
    const ourBest = ourResults[0]?.timeMs
    const oppBest = oppResults[0]?.timeMs

    if (ourBest !== undefined && oppBest !== undefined && ourBest < oppBest) {
      ourRoundsWon++
    }

    if (ourBest !== undefined && (bestOurTime === undefined || ourBest < bestOurTime)) {
      bestOurTime = ourBest
    }
    if (oppBest !== undefined && (bestOpponentTime === undefined || oppBest < bestOpponentTime)) {
      bestOpponentTime = oppBest
    }
  }

  return { ourRoundsWon, bestOurTime, bestOpponentTime }
}
