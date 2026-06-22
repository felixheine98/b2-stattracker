"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Plus, User, Trash2, Link2, Link2Off, Wand2 } from "lucide-react"

interface UserOption {
  id: string
  name: string
  username: string
  playerId: string | null
}

interface Player {
  id: string
  tmId: string
  name: string
  createdAt: Date
  user?: { id: string; name: string; email: string | null; username: string } | null
  _count?: { roundResults: number }
}

interface Props {
  players: Player[]
  users: UserOption[]
  canManage: boolean
}

export function PlayersView({ players: initial, users, canManage }: Props) {
  const router = useRouter()
  const [players, setPlayers] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [autoLinking, startAutoLink] = useTransition()

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch("/b2-stats/api/players", {
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
    const data = await res.json()
    setPlayers((p) => [...p, { ...data, user: null, _count: { roundResults: 0 } }].sort((a, b) => a.name.localeCompare(b.name)))
    setShowForm(false)
    ;(e.target as HTMLFormElement).reset()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this player?")) return
    setDeleting(id)
    await fetch(`/b2-stats/api/players/${id}`, { method: "DELETE" })
    setDeleting(null)
    setPlayers((p) => p.filter((pl) => pl.id !== id))
  }

  async function handleLink(playerId: string, userId: string | null) {
    setLinking(playerId)
    const res = await fetch(`/b2-stats/api/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    setLinking(null)
    if (!res.ok) return
    const data = await res.json()
    setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, user: data.user } : pl)))
  }

  function handleAutoLink() {
    startAutoLink(async () => {
      for (const player of players) {
        if (player.user) continue
        const match = users.find(
          (u) =>
            !u.playerId &&
            (u.name.toLowerCase().trim() === player.name.toLowerCase().trim() ||
              u.username.toLowerCase().trim() === player.name.toLowerCase().trim())
        )
        if (match) await handleLink(player.id, match.id)
      }
      router.refresh()
    })
  }

  // Show unlinked users plus whoever is already linked to this player
  function availableUsers(player: Player) {
    return users.filter((u) => !u.playerId || u.id === player.user?.id)
  }

  const hasUnlinked = players.some((p) => !p.user)
  const autoLinkCount = players.filter((p) => {
    if (p.user) return false
    return users.some(
      (u) =>
        !u.playerId &&
        (u.name.toLowerCase().trim() === p.name.toLowerCase().trim() ||
          u.username.toLowerCase().trim() === p.name.toLowerCase().trim())
    )
  }).length

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0f0]">Players</h1>
          <p className="text-[#9a9090] text-sm mt-0.5">{players.length} registered team members</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && hasUnlinked && autoLinkCount > 0 && (
            <Button variant="outline" onClick={handleAutoLink} disabled={autoLinking}>
              <Wand2 size={15} />
              Auto-link ({autoLinkCount})
            </Button>
          )}
          {canManage && (
            <Button onClick={() => { setShowForm(true); setError("") }}>
              <Plus size={16} />
              Add Player
            </Button>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User size={32} className="mx-auto text-[#5e5858] mb-3" />
            <p className="text-[#9a9090] text-sm">No players yet. Add your first teammate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-[#2d2829] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2d2829] bg-[#251f20]">
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">TM ID</th>
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Linked account</th>
                <th className="text-right px-4 py-3 text-[#9a9090] font-medium">Results</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => (
                <tr
                  key={player.id}
                  className={`border-b border-[#2d2829] last:border-0 ${i % 2 === 0 ? "bg-[#1c1819]" : "bg-[#1c1819]/60"}`}
                >
                  <td className="px-4 py-3 font-medium text-[#f5f0f0]">{player.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#5e5858]">{player.tmId}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={player.user?.id ?? ""}
                          onChange={(e) => handleLink(player.id, e.target.value || null)}
                          disabled={linking === player.id}
                          className="h-7 rounded border border-[#3a3435] bg-[#251f20] px-2 text-xs text-[#f5f0f0] focus:outline-none focus:ring-1 focus:ring-[#FBD00D] disabled:opacity-50"
                        >
                          <option value="">— no account —</option>
                          {availableUsers(player).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.username})
                            </option>
                          ))}
                        </select>
                        {player.user && (
                          <button
                            onClick={() => handleLink(player.id, null)}
                            disabled={linking === player.id}
                            className="text-[#5e5858] hover:text-[#ED1F24] disabled:opacity-40"
                            title="Unlink"
                          >
                            <Link2Off size={13} />
                          </button>
                        )}
                        {!player.user && linking !== player.id && (
                          <Link2 size={13} className="text-[#3a3435]" />
                        )}
                      </div>
                    ) : (
                      <span className="text-[#9a9090]">
                        {player.user?.name ?? <span className="text-[#3a3435]">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[#9a9090]">{player._count?.roundResults ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(player.id)}
                        disabled={deleting === player.id}
                        className="text-[#5e5858] hover:text-[#ED1F24]"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={canManage && showForm} onClose={() => setShowForm(false)}>
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
            <p className="text-xs text-[#5e5858]">The UUID from the Trackmania player ID field in the CSV</p>
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Add Player"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
