"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Plus, User, Trash2 } from "lucide-react"

interface Player {
  id: string
  tmId: string
  name: string
  createdAt: Date
  user?: { id: string; name: string; email: string } | null
  _count?: { roundResults: number }
}

export function PlayersView({ players: initial }: { players: Player[] }) {
  const router = useRouter()
  const [players, setPlayers] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), tmId: form.get("tmId") }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to create player")
      return
    }
    setShowForm(false)
    router.refresh()
    const data = await res.json()
    setPlayers((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this player?")) return
    setDeleting(id)
    await fetch(`/api/players/${id}`, { method: "DELETE" })
    setDeleting(null)
    setPlayers((p) => p.filter((pl) => pl.id !== id))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Players</h1>
          <p className="text-slate-400 text-sm mt-0.5">{players.length} registered team members</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError("") }}>
          <Plus size={16} />
          Add Player
        </Button>
      </div>

      {players.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm">No players yet. Add your first teammate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">TM ID</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Linked Account</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Results</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => (
                <tr
                  key={player.id}
                  className={`border-b border-slate-800 last:border-0 ${i % 2 === 0 ? "bg-slate-900" : "bg-slate-900/50"}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-100">{player.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{player.tmId}</td>
                  <td className="px-4 py-3 text-slate-400">{player.user?.name ?? <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{player._count?.roundResults ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(player.id)}
                      disabled={deleting === player.id}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <DialogTitle>Add Player</DialogTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" name="name" placeholder="Tommy.TM" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmId">Trackmania Player ID</Label>
            <Input
              id="tmId"
              name="tmId"
              placeholder="15b02a29-73f5-459d-a46e-4a28b1941c34"
              pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
              required
            />
            <p className="text-xs text-slate-500">The UUID from the Trackmania player ID field in the CSV</p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Add Player"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
