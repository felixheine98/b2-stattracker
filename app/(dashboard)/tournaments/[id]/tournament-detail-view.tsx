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
import { Plus, ArrowLeft, Calendar, Users, ChevronRight, Swords, Trash2 } from "lucide-react"
import { formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface Player {
  id: string
  tmId: string
  name: string
}

interface Match {
  id: string
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  lineup?: {
    id: string
    slots: Array<{ id: string; player: Player }>
  } | null
  _count: { rounds: number }
}

interface Tournament {
  id: string
  name: string
  format: Format
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  matches: Match[]
}

interface Props {
  tournament: Tournament
  players: Player[]
}

export function TournamentDetailView({ tournament, players }: Props) {
  const router = useRouter()
  const [matches, setMatches] = useState(tournament.matches)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch(`/api/tournaments/${tournament.id}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opponent: form.get("opponent") || null,
        date: form.get("date") || null,
        notes: form.get("notes") || null,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to create match")
      return
    }
    const data = await res.json()
    setMatches((m) => [{ ...data, lineup: null, _count: { rounds: 0 } }, ...m])
    setShowForm(false)
    router.push(`/tournaments/${tournament.id}/matches/${data.id}`)
  }

  async function handleDelete(matchId: string) {
    if (!confirm("Delete this match and all its data?")) return
    setDeleting(matchId)
    await fetch(`/api/tournaments/${tournament.id}/matches/${matchId}`, { method: "DELETE" })
    setDeleting(null)
    setMatches((m) => m.filter((match) => match.id !== matchId))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-4"
        >
          <ArrowLeft size={14} />
          Tournaments
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-100">{tournament.name}</h1>
              <Badge variant={tournament.format.startsWith("TIME") ? "cyan" : "purple"}>
                {formatLabel(tournament.format)}
              </Badge>
            </div>
            {tournament.description && (
              <p className="text-slate-400 text-sm">{tournament.description}</p>
            )}
            {(tournament.startDate || tournament.endDate) && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                <Calendar size={12} />
                {tournament.startDate && new Date(tournament.startDate).toLocaleDateString()}
                {tournament.startDate && tournament.endDate && " – "}
                {tournament.endDate && new Date(tournament.endDate).toLocaleDateString()}
              </div>
            )}
          </div>
          <Button onClick={() => { setShowForm(true); setError("") }}>
            <Plus size={16} />
            Add Match
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Matches ({matches.length})
        </h2>
        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Swords size={28} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm">No matches yet. Add your first match.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <div key={match.id} className="flex items-center gap-2">
                <Link href={`/tournaments/${tournament.id}/matches/${match.id}`} className="flex-1">
                  <Card className="hover:border-slate-600 transition-colors cursor-pointer">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Swords size={15} className="text-slate-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {match.opponent ?? "Unknown opponent"}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {match.date && (
                              <span>{new Date(match.date).toLocaleDateString()}</span>
                            )}
                            <span>{match._count.rounds} round{match._count.rounds !== 1 ? "s" : ""}</span>
                            {match.lineup && (
                              <span className="flex items-center gap-1">
                                <Users size={10} />
                                {match.lineup.slots.length} players
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600" />
                    </CardContent>
                  </Card>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(match.id)}
                  disabled={deleting === match.id}
                  className="shrink-0 text-slate-600 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <DialogTitle>Add Match</DialogTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="opponent">Opponent team</Label>
            <Input id="opponent" name="opponent" placeholder="Team Rockets" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-slate-600">(optional)</span></Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Match"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
