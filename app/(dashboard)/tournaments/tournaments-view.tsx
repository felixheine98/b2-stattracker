"use client"

import { BASE_PATH } from "@/lib/base-path"
import { tournamentPath } from "@/lib/paths"
import { FormatBuilder } from "@/components/format-builder"
import { MatchRulesFields } from "@/components/match-rules-fields"
import { RuleTemplateSelect, SaveAsTemplateButton } from "@/components/rule-template-controls"
import { StagePlanFields } from "@/components/stage-plan-fields"
import { ruledFormats } from "@/lib/match-rules"
import { draftOf, playoffBodyOf, playoffDraftOf, rulesBodyOf, type PlayoffRulesDraft, type RulesDraft } from "@/lib/match-rules-form"
import { DEFAULT_STAGE_PLAN } from "@/lib/stages"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSyncedState } from "@/lib/use-synced-state"
import { formatDay, localTodayKey } from "@/lib/player-status"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { Plus, Timer, Trophy, ChevronRight } from "lucide-react"
import { cn, formatLabel } from "@/lib/utils"
import { groupByYear } from "@/lib/tournament-list"
import { STYLE_ORDER, filterByStyle, needsFormats, styleLabel, styleParam, stylesInUse } from "@/lib/comp-styles"
import type { CompStyle, Format } from "@prisma/client"

interface Tournament {
  id: string
  slug?: string | null
  name: string
  formats: Format[]
  style: CompStyle
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  createdAt: Date
  _count: { matches: number }
  tfhRace?: { kind: string; _count: { teams: number } } | null
}

function formatBadgeVariant(format: Format): "primary" | "secondary" {
  return format === "TIME_ATTACK_10" ? "primary" : "secondary"
}

// style: the style the list is narrowed to (?style=…), null for all tournaments
export function TournamentsView({ tournaments: initial, style, canManage, isAdmin }: { tournaments: Tournament[]; style: CompStyle | null; canManage: boolean; isAdmin: boolean }) {
  const router = useRouter()
  const [tournaments, setTournaments] = useSyncedState(initial)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [formats, setFormats] = useState<Format[]>([])
  const [stagePlan, setStagePlan] = useState(DEFAULT_STAGE_PLAN)
  const [formStyle, setFormStyle] = useState<CompStyle | "">("")
  // A new tournament with formats always gets rules; nothing is filled in for the user
  const [rules, setRules] = useState<RulesDraft>(() => draftOf(null))
  const [playoffRules, setPlayoffRules] = useState<PlayoffRulesDraft | null>(null)
  const shown = filterByStyle(tournaments, style)
  const styles = stylesInUse(tournaments)

  function openForm() {
    setFormats([])
    setFormStyle(style ?? "")
    setStagePlan(DEFAULT_STAGE_PLAN)
    setRules(draftOf(null))
    setPlayoffRules(null)
    setError("")
    setShowForm(true)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (formats.length === 0 && (!formStyle || needsFormats(formStyle))) {
      setError("Add at least one format to the sequence")
      return
    }
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch(`${BASE_PATH}/api/tournaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        formats,
        style: formStyle,
        description: form.get("description") || null,
        startDate: form.get("startDate") || null,
        endDate: form.get("endDate") || null,
        stages: stagePlan,
        ...(ruledFormats(formats).length > 0 && { rules: rulesBodyOf(rules), playoffRules: playoffRules && playoffBodyOf(playoffRules) }),
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
    router.push(tournamentPath(data))
    // A first tournament of a style adds it to the sidebar
    router.refresh()
  }

  return (
    <div className="space-y-6 page-wide">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Tournaments</h1>
          <p className="text-fg-muted text-sm mt-0.5">{shown.length} tournament{shown.length !== 1 ? "s" : ""}{style ? ` · ${styleLabel(style)}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
        {isAdmin && <Link href="/tfh-import"><Button variant="outline">Import TFH race</Button></Link>}
        {canManage && <Link href="/rule-templates"><Button variant="outline">Rule templates</Button></Link>}
        {canManage && (
          <Button onClick={openForm}>
            <Plus size={16} />
            New Tournament
          </Button>
        )}
        </div>
      </div>

      {styles.length > 0 && (
        <nav aria-label="Style" className="flex flex-wrap gap-2">
          {[null, ...styles].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/tournaments?style=${styleParam(s)}` : "/tournaments"}
              aria-current={s === style ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                s === style ? "border-brand/30 bg-brand/15 text-brand-ink" : "border-line-strong text-fg-muted hover:bg-raised hover:text-fg"
              )}
            >
              {s ? styleLabel(s) : "All"}
            </Link>
          ))}
        </nav>
      )}

      {style === "ENDURANCE" && shown.some((t) => t.tfhRace) && (
        <Link href="/tfh" className="block">
          <Card className="border-brand/30 bg-brand/5 hover:border-brand/60 transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Timer size={22} className="shrink-0 text-brand-ink" />
                <div className="min-w-0">
                  <p className="font-semibold text-fg">TFH driver totals</p>
                  <p className="text-sm text-fg-muted">All B2 drivers compared over {shown.filter((t) => t.tfhRace).length} TFH races: CPM per edition, drive time and checkpoints</p>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-fg-subtle" />
            </CardContent>
          </Card>
        </Link>
      )}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy size={32} className="mx-auto text-fg-subtle mb-3" />
            <p className="text-fg-muted text-sm">{tournaments.length === 0 ? "No tournaments yet. Create your first one." : "No tournaments of this style."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
        {groupByYear(shown).map((group) => (
        <section key={group.year}>
        <h2 className="mb-3 flex items-center gap-3 text-sm font-semibold text-fg-muted">
          {group.year}
          <span className="h-px flex-1 bg-line" />
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {group.tournaments.map((t) => (
            <Link key={t.id} href={tournamentPath(t)}>
              <Card className="h-full hover:border-line-strong transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      <Badge variant="purple">{styleLabel(t.style)}</Badge>
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
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-fg-subtle">
                    <span>{t.tfhRace ? `${t.tfhRace._count.teams} teams` : `${t._count.matches} match${t._count.matches !== 1 ? "es" : ""}`}</span>
                    <div className="flex items-center gap-1">
                      {t.startDate && (
                        <span>{formatDay(t.startDate)}</span>
                      )}
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        </section>
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
            <Label htmlFor="style">Style</Label>
            <Select id="style" name="style" value={formStyle} onChange={(e) => setFormStyle(e.target.value as CompStyle)} required>
              <option value="" disabled>Select a style</option>
              {STYLE_ORDER.map((s) => <option key={s} value={s}>{styleLabel(s)}</option>)}
            </Select>
          </div>
          <RuleTemplateSelect onPick={(t) => { setFormats(t.formats as Format[]); setRules(draftOf(t.rules)); setPlayoffRules(playoffDraftOf(t.playoffRules)) }} />
          <div className="space-y-1.5">
            <Label>Format sequence{formStyle && !needsFormats(formStyle) && <span className="text-fg-subtle"> (optional for endurance)</span>}</Label>
            <FormatBuilder value={formats} onChange={setFormats} />
          </div>
          <MatchRulesFields formats={formats} value={rules} onChange={(r) => r && setRules(r)} playoff={playoffRules} onPlayoffChange={setPlayoffRules} />
          {ruledFormats(formats).length > 0 && (
            <SaveAsTemplateButton content={() => ({ formats, rules: rulesBodyOf(rules), playoffRules: playoffRules && playoffBodyOf(playoffRules) })} />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-fg-subtle">(optional)</span></Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <StagePlanFields value={stagePlan} onChange={setStagePlan} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={localTodayKey()} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="dialog-footer flex gap-2 justify-end pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Tournament"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
