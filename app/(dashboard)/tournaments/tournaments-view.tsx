"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Trophy, ChevronRight } from "lucide-react"
import { formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface Tournament {
  id: string
  name: string
  format: Format
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  createdAt: Date
  _count: { matches: number }
}

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: "ROUND_1V1", label: "1v1 Round Mode" },
  { value: "ROUND_2V2", label: "2v2 Round Mode" },
  { value: "ROUND_3V3", label: "3v3 Round Mode" },
  { value: "ROUND_4V4", label: "4v4 Round Mode" },
  { value: "ROUND_5V5", label: "5v5 Round Mode" },
  { value: "TIME_ATTACK_10", label: "10-Round Time Attack" },
]

function formatBadgeVariant(format: Format) {
  return format.startsWith("TIME") ? "cyan" : "purple"
}

export function TournamentsView({ tournaments: initial }: { tournaments: Tournament[] }) {
  const router = useRouter()
  const [tournaments, setTournaments] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        format: form.get("format"),
        description: form.get("description") || null,
        startDate: form.get("startDate") || null,
        endDate: form.get("endDate") || null,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to create tournament")
      return
    }
    const data = await res.json()
    setTournaments((t) => [{ ...data, _count: { matches: 0 } }, ...t])
    setShowForm(false)
    router.push(`/tournaments/${data.id}`)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Tournaments</h1>
          <p className="text-slate-400 text-sm mt-0.5">{tournaments.length} tournaments</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError("") }}>
          <Plus size={16} />
          New Tournament
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm">No tournaments yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card className="h-full hover:border-slate-600 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <Badge variant={formatBadgeVariant(t.format)} className="shrink-0">
                      {formatLabel(t.format)}
                    </Badge>
                  </div>
                  {t.description && <CardDescription>{t.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{t._count.matches} match{t._count.matches !== 1 ? "es" : ""}</span>
                    <div className="flex items-center gap-1">
                      {t.startDate && (
                        <span>{new Date(t.startDate).toLocaleDateString()}</span>
                      )}
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showForm} onClose={() => setShowForm(false)} className="max-w-lg">
        <DialogTitle>New Tournament</DialogTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Spring Cup 2025" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="format">Format</Label>
            <Select id="format" name="format" required defaultValue="">
              <option value="" disabled>Select format</option>
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-slate-600">(optional)</span></Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Tournament"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
