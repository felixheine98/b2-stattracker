"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Copy, Pencil, Plus, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import { matchTag } from "@/lib/match-order"
import {
  hasUnpublishedChanges,
  matchLineup,
  planHints,
  planPool,
  type MatchdayAnswer,
  type PlanHint,
  type PlanVariant,
  type Seats,
} from "@/lib/matchday-plan"
import type { LoadedPlan } from "@/lib/matchday-plan-db"
import { formatDay } from "@/lib/player-status"
import { cn, formatLabel } from "@/lib/utils"
import type { Format } from "@/types"

// Dates arrive as strings from the server
type Plan = Omit<LoadedPlan, "publishedAt" | "matches"> & {
  publishedAt: string | Date | null
  matches: Array<Omit<LoadedPlan["matches"][number], "date" | "createdAt"> & { date: string | Date | null; createdAt: string | Date }>
}

interface Props {
  initial: Plan
  apiPath: string
  title: { lineup: string; tournament: string; stage: string; day: string }
  links: { tournament: string; lineup: string; addMatch: string; match: Record<string, string> }
  // The formats of the competition, for the day lineup
  dayFormats: Format[]
}

const ANSWERS: Array<{ value: MatchdayAnswer | ""; label: string }> = [
  { value: "", label: "No answer" },
  { value: "FIX", label: "Fix" },
  { value: "PARTIAL", label: "Partly" },
  { value: "MAYBE", label: "Maybe" },
  { value: "OUT", label: "Out" },
]

const ANSWER_STYLE: Record<MatchdayAnswer, string> = {
  FIX: "text-ok",
  PARTIAL: "text-brand-ink",
  MAYBE: "text-fg-muted",
  OUT: "text-danger",
}

const DAY = "__day"

export function MatchdayPlanView({ initial, apiPath, title, links, dayFormats }: Props) {
  const [plan, setPlan] = useState<Plan>(initial)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [variantId, setVariantId] = useState(initial.publishedVariantId ?? initial.variants[0]?.id)
  const variant = plan.variants.find((v) => v.id === variantId) ?? plan.variants[0]

  const answerOf = (playerId: string) => plan.answers[playerId]?.answer ?? undefined
  const answers = Object.fromEntries(plan.kader.map((p) => [p.id, answerOf(p.id)]))
  const pool = planPool(plan.kader, answers)
  const nameOf = (playerId: string) => plan.kader.find((p) => p.id === playerId)?.name ?? "Unknown"
  const hints = planHints(variant.seats, plan.matches, answers, plan.absences)

  const publishedVariant = plan.variants.find((v) => v.id === plan.publishedVariantId)
  const changed = !!plan.published && !!publishedVariant && hasUnpublishedChanges(plan.published, publishedVariant.seats, plan.matches)
  const upToDate = !!plan.published && variant.id === plan.publishedVariantId && !changed

  async function send(body: Record<string, unknown>) {
    setError("")
    setBusy(true)
    const res = await fetch(`${BASE_PATH}${apiPath}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setBusy(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error ?? "Could not save")
      return null
    }
    setPlan(data)
    return data as Plan
  }

  // Changes the seats of the shown variant at once and saves them
  function saveSeats(seats: PlanVariant) {
    setPlan((p) => ({ ...p, variants: p.variants.map((v) => (v.id === variant.id ? { ...v, seats } : v)) }))
    void send({ action: "seats", variantId: variant.id, seats })
  }

  function setSeat(scope: string, format: Format, index: number, playerId: string | null, current: Array<string | null>) {
    const next = [...current]
    next[index] = playerId
    const seats: PlanVariant = { day: { ...variant.seats.day }, matches: { ...variant.seats.matches } }
    if (scope === DAY) seats.day[format] = next
    else seats.matches[scope] = { ...seats.matches[scope], [format]: next }
    saveSeats(seats)
  }

  // A match takes the day lineup of a format as its own to change it, or gives its own up again
  function toggleOwn(matchId: string, format: Format, own: boolean, current: Array<string | null>) {
    const mine: Seats = { ...variant.seats.matches[matchId] }
    if (own) mine[format] = [...current]
    else delete mine[format]
    const matches = { ...variant.seats.matches, [matchId]: mine }
    if (Object.keys(mine).length === 0) delete matches[matchId]
    saveSeats({ day: variant.seats.day, matches })
  }

  async function addVariant(copy: boolean) {
    const name = prompt("Name of the new variant", copy ? `${variant.name} (copy)` : `Variant ${plan.variants.length + 1}`)?.trim()
    if (!name) return
    const saved = await send({ action: "addVariant", name, ...(copy && { copyOf: variant.id }) })
    if (saved) setVariantId(saved.variants[saved.variants.length - 1].id)
  }

  async function renameVariant() {
    const name = prompt("Name of the variant", variant.name)?.trim()
    if (name && name !== variant.name) await send({ action: "renameVariant", variantId: variant.id, name })
  }

  async function deleteVariant() {
    if (!confirm(`Delete the variant “${variant.name}”?`)) return
    const saved = await send({ action: "deleteVariant", variantId: variant.id })
    if (saved) setVariantId(saved.publishedVariantId ?? saved.variants[0].id)
  }

  async function publish() {
    await send({ action: "publish", variantId: variant.id })
  }

  function hintText(hint: PlanHint): string {
    if (hint.kind === "open") return `${formatLabel(hint.format)}: ${hint.count} place${hint.count > 1 ? "s" : ""} open`
    if (hint.kind === "out") return `${formatLabel(hint.format)}: ${nameOf(hint.playerId)} is out`
    return `${formatLabel(hint.format)}: ${nameOf(hint.playerId)} is not there for this match`
  }

  // A select for one place; out players cannot be picked, but one already placed stays visible
  function seatSelect(scope: string, format: Format, index: number, current: Array<string | null>, disabled = false) {
    const value = current[index]
    const taken = current.filter((id, i) => id && i !== index)
    const option = (p: { id: string; name: string }) => (
      <option key={p.id} value={p.id} disabled={taken.includes(p.id)}>
        {p.name}
        {answers[p.id] === "PARTIAL" ? " (partly)" : answers[p.id] === "MAYBE" ? " (maybe)" : !answers[p.id] ? " (no answer)" : ""}
      </option>
    )
    return (
      <Select
        key={index}
        aria-label={`${formatLabel(format)} place ${index + 1}`}
        value={value ?? ""}
        disabled={disabled || busy}
        onChange={(e) => setSeat(scope, format, index, e.target.value || null, current)}
        className={cn("h-9 min-w-0", value && answers[value] === "OUT" && "border-danger text-danger")}
      >
        <option value="">— open —</option>
        {pool.top.length > 0 && <optgroup label="Available">{pool.top.map(option)}</optgroup>}
        {pool.below.length > 0 && <optgroup label="Maybe / no answer">{pool.below.map(option)}</optgroup>}
        {value && answers[value] === "OUT" && <option value={value}>{nameOf(value)} (out)</option>}
      </Select>
    )
  }

  const dayLineup = matchLineup({ day: variant.seats.day, matches: {} }, { id: DAY, formats: dayFormats })

  return (
    <div className="space-y-6 page-wide">
      <div>
        <Link href={links.lineup} className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft size={14} />
          {title.lineup}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="page-title mb-1 flex items-center gap-2 text-fg">
              <ClipboardList size={20} className="shrink-0 text-brand-ink" />
              <span className="break-words">Plan · {title.stage}</span>
            </h1>
            <p className="text-xs text-fg-subtle">
              {title.lineup} · <Link href={links.tournament} className="hover:text-fg">{title.tournament}</Link> · {formatDay(title.day)} · only visible to the lineup&apos;s managers
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {upToDate ? (
              <Badge variant="green">
                <CheckCircle2 size={12} className="mr-1 inline" />
                Finalised {plan.publishedAt ? formatDay(plan.publishedAt) : ""}
              </Badge>
            ) : plan.published ? (
              <Badge variant="yellow">{changed ? "Unpublished changes" : `Finalised: ${publishedVariant?.name ?? "another variant"}`}</Badge>
            ) : (
              <Badge>Not finalised · players see no lineup yet</Badge>
            )}
            <Button onClick={publish} disabled={busy || upToDate}>
              <CheckCircle2 size={16} />
              Finalise “{variant.name}”
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      <div className="page-columns">
        {/* Availability */}
        <section>
          <h2 className="section-title mb-3 flex items-center gap-2">
            <Users size={15} />
            Availability
          </h2>
          <Card>
            <CardContent className="divide-y divide-line p-0">
              {plan.kader.map((player) => {
                const entry = plan.answers[player.id]
                return (
                  <div key={player.id} className="space-y-2 px-4 py-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_minmax(0,1.3fr)]">
                      <span className={cn("min-w-0 truncate font-medium", entry?.answer ? ANSWER_STYLE[entry.answer] : "text-fg")}>{player.name}</span>
                      <Select
                        aria-label={`Answer of ${player.name}`}
                        value={entry?.answer ?? ""}
                        disabled={busy}
                        onChange={(e) => send({ action: "answer", playerId: player.id, answer: e.target.value || null })}
                        className="h-9"
                      >
                        {ANSWERS.map((a) => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </Select>
                    <Input
                      key={`${player.id}:${entry?.note ?? ""}`}
                      aria-label={`Note on ${player.name}`}
                      placeholder="Note, e.g. only until 22:00"
                      defaultValue={entry?.note ?? ""}
                      className="col-span-2 h-9 sm:col-span-1"
                      onBlur={(e) => {
                        const note = e.target.value.trim()
                        if (note !== (entry?.note ?? "")) void send({ action: "answer", playerId: player.id, answer: entry?.answer ?? null, note })
                      }}
                    />
                    </div>
                    {entry?.answer === "PARTIAL" && plan.matches.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                        <span>Not there for:</span>
                        {plan.matches.map((match) => (
                          <label key={match.id} className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={plan.absences.some((a) => a.playerId === player.id && a.matchId === match.id)}
                              disabled={busy}
                              onChange={(e) => send({ action: "absence", playerId: player.id, matchId: match.id, absent: e.target.checked })}
                            />
                            {matchTag(match) || "Match"} {match.opponent ? `vs ${match.opponent}` : ""}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {plan.kader.length === 0 && <p className="px-4 py-3 text-sm text-fg-subtle">The lineup has no players yet.</p>}
            </CardContent>
          </Card>
        </section>

        <div className="page-main space-y-6">
          {/* Variants */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {plan.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    v.id === variant.id ? "border-brand bg-brand/15 text-fg" : "border-line bg-raised text-fg-soft hover:border-line-strong"
                  )}
                >
                  {v.name}
                  {v.id === plan.publishedVariantId && <CheckCircle2 size={12} className="ml-1 inline text-ok" />}
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => addVariant(false)} disabled={busy}>
                <Plus size={14} />
                Variant
              </Button>
              <Button variant="ghost" size="sm" onClick={() => addVariant(true)} disabled={busy} title="Copy this variant">
                <Copy size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={renameVariant} disabled={busy} title="Rename this variant">
                <Pencil size={14} />
              </Button>
              {plan.variants.length > 1 && variant.id !== plan.publishedVariantId && (
                <Button variant="ghost" size="sm" onClick={deleteVariant} disabled={busy} title="Delete this variant" className="text-fg-subtle hover:text-danger">
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </section>

          {/* Day lineup */}
          <section>
            <h2 className="section-title mb-1">Day lineup</h2>
            <p className="mb-3 text-xs text-fg-subtle">Every match of the day follows it, unless a match has a lineup of its own for a format.</p>
            <Card>
              <CardContent className="space-y-3 pt-5">
                {dayFormats.map((format) => (
                  <div key={format} className="grid grid-cols-1 gap-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center">
                    <span className="text-sm font-semibold text-fg">{formatLabel(format)}</span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {dayLineup[format]!.map((_, i) => seatSelect(DAY, format, i, dayLineup[format]!))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* Matches */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Matches ({plan.matches.length})</h2>
              <Link href={links.addMatch} className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline">
                <Plus size={14} />
                Add match
              </Link>
            </div>
            {plan.matches.length === 0 && (
              <p className="text-sm text-fg-subtle">No matches on this match day yet. The day lineup applies to every match added later.</p>
            )}
            <div className="space-y-3">
              {plan.matches.map((match) => {
                const lineup = matchLineup(variant.seats, match)
                const own = variant.seats.matches[match.id] ?? {}
                const matchHints = hints.filter((h) => h.matchId === match.id)
                return (
                  <Card key={match.id}>
                    <CardContent className="space-y-3 pt-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link href={links.match[match.id]} className="min-w-0 font-medium text-fg hover:text-brand-ink">
                          {matchTag(match) && <span className="mr-2 font-mono text-xs text-brand-ink">{matchTag(match)}</span>}
                          vs {match.opponent ?? "opponent open"}
                        </Link>
                        {match.date && <span className="text-xs text-fg-subtle">{formatDay(match.date)}</span>}
                      </div>
                      {match.formats.length === 0 && <p className="text-xs text-fg-subtle">This match has no sub-matches.</p>}
                      {match.formats.map((format) => {
                        const isOwn = !!own[format]
                        return (
                          <div key={format} className="grid grid-cols-1 gap-2 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center">
                            <span className="text-sm font-semibold text-fg">{formatLabel(format)}</span>
                            {isOwn ? (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {lineup[format]!.map((_, i) => seatSelect(match.id, format, i, lineup[format]!))}
                              </div>
                            ) : (
                              <p className="text-sm text-fg-soft">
                                {lineup[format]!.map((id) => (id ? nameOf(id) : "—")).join(", ")}
                                <span className="ml-2 text-xs text-fg-subtle">day lineup</span>
                              </p>
                            )}
                            <label className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                              <input type="checkbox" checked={isOwn} disabled={busy} onChange={(e) => toggleOwn(match.id, format, e.target.checked, lineup[format]!)} />
                              Own lineup
                            </label>
                          </div>
                        )
                      })}
                      {matchHints.length > 0 && (
                        <ul className="space-y-1 rounded-lg border border-bronze/40 bg-bronze/5 px-3 py-2 text-xs text-fg-soft">
                          {matchHints.map((hint, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-bronze" />
                              {hintText(hint)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
