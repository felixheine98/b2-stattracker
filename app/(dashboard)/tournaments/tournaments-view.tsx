"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSyncedState } from "@/lib/use-synced-state"
import { localTodayKey } from "@/lib/player-status"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Trophy, ChevronRight, X } from "lucide-react"
import { formatLabel, formatLabelLong } from "@/lib/utils"
import type { Format } from "@prisma/client"

interface Tournament {
  id: string
  name: string
  formats: Format[]
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  createdAt: Date
  _count: { matches: number }
}

const ALL_FORMATS: Format[] = [
  "TIME_ATTACK_10",
  "ROUND_1V1",
  "ROUND_2V2",
  "ROUND_3V3",
  "ROUND_4V4",
  "ROUND_5V5",
]

function formatBadgeVariant(format: Format): "primary" | "secondary" {
  return format === "TIME_ATTACK_10" ? "primary" : "secondary"
}

function FormatBuilder({ value, onChange }: { value: Format[]; onChange: (v: Format[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ALL_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange([...value, f])}
            className="inline-flex items-center gap-1 rounded-full border border-[#3a3435] bg-[#251f20] px-2.5 py-1 text-xs text-[#9a9090] hover:border-[#FBD00D] hover:text-[#FBD00D] transition-colors"
          >
            <Plus size={10} />
            {formatLabelLong(f)}
          </button>
        ))}
      </div>
      <div className="min-h-10 rounded-lg border border-[#2d2829] bg-[#1c1819] p-2 flex flex-wrap gap-1.5 items-start">
        {value.length === 0 ? (
          <p className="text-xs text-[#3a3435] self-center px-1">Click formats above to build the sequence</p>
        ) : (
          value.map((f, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${
                f === "TIME_ATTACK_10"
                  ? "bg-[#FBD00D]/15 text-[#FBD00D] border-[#FBD00D]/30"
                  : "bg-[#002484]/20 text-[#6b8fff] border-[#002484]/40"
              }`}
            >
              <span className="text-[#5e5858] font-normal mr-0.5">{i + 1}.</span>
              {formatLabel(f)}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export function TournamentsView({ tournaments: initial, canManage }: { tournaments: Tournament[]; canManage: boolean }) {
  const router = useRouter()
  const [tournaments, setTournaments] = useSyncedState(initial)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [formats, setFormats] = useState<Format[]>([])

  function openForm() {
    setFormats([])
    setError("")
    setShowForm(true)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (formats.length === 0) {
      setError("Add at least one format to the sequence")
      return
    }
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch("/b2-stats/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        formats,
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
          <h1 className="text-2xl font-bold text-[#f5f0f0]">Tournaments</h1>
          <p className="text-[#9a9090] text-sm mt-0.5">{tournaments.length} tournaments</p>
        </div>
        {canManage && (
          <Button onClick={openForm}>
            <Plus size={16} />
            New Tournament
          </Button>
        )}
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy size={32} className="mx-auto text-[#5e5858] mb-3" />
            <p className="text-[#9a9090] text-sm">No tournaments yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card className="h-full hover:border-[#3a3435] transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      {t.formats.slice(0, 3).map((f, i) => (
                        <Badge key={i} variant={formatBadgeVariant(f)}>
                          {formatLabel(f)}
                        </Badge>
                      ))}
                      {t.formats.length > 3 && (
                        <Badge variant="default">+{t.formats.length - 3}</Badge>
                      )}
                    </div>
                  </div>
                  {t.description && <CardDescription>{t.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-[#5e5858]">
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

      <Dialog open={canManage && showForm} onClose={() => setShowForm(false)} className="max-w-lg">
        <DialogTitle>New Tournament</DialogTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Spring Cup 2025" required />
          </div>
          <div className="space-y-1.5">
            <Label>Format sequence</Label>
            <FormatBuilder value={formats} onChange={setFormats} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-[#5e5858]">(optional)</span></Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={localTodayKey()} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Tournament"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
