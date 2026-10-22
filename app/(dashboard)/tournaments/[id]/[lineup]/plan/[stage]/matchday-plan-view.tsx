"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Copy, Pencil, Plus, Trash2, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BASE_PATH } from "@/lib/base-path"
import { matchTag } from "@/lib/match-order"
import {
  hasUnpublishedChanges,
  matchLineup,
  planHints,
  placePlayer,
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

const ANSWERS: Array<{ value: MatchdayAnswer; label: string; on: string }> = [
  { value: "FIX", label: "Fix", on: "border-green-400/70 bg-green-400/15 text-green-400" },
  { value: "PARTIAL", label: "Partly", on: "border-bronze/70 bg-bronze/15 text-bronze" },
  { value: "MAYBE", label: "Maybe", on: "border-info/70 bg-info/15 text-info" },
  { value: "OUT", label: "Out", on: "border-danger/70 bg-danger/15 text-danger" },
]

const DOT: Record<MatchdayAnswer, string> = {
  FIX: "bg-green-400",
  PARTIAL: "bg-bronze",
  MAYBE: "bg-info",
  OUT: "bg-danger",
}

const DAY = "__day"

// A player picked up from the kader, or from a place of a lineup
interface Held {
  playerId: string
  from?: { scope: string; format: Format }
}

export function MatchdayPlanView({ initial, apiPath, title, links, dayFormats }: Props) {
  const [plan, setPlan] = useState<Plan>(initial)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [variantId, setVariantId] = useState(initial.publishedVariantId ?? initial.variants[0]?.id)
  const variant = plan.variants.find((v) => v.id === variantId) ?? plan.variants[0]
  // The player tapped (on a phone) or dragged (on a computer), waiting for a place
  const [picked, setPicked] = useState<Held | null>(null)
  const [dragging, setDragging] = useState<Held | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const answerOf = (playerId: string) => plan.answers[playerId]?.answer ?? undefined
  const answers = Object.fromEntries(plan.kader.map((p) => [p.id, answerOf(p.id)]))
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

  // The places of a format on the day (scope DAY) or in a match of its own
  function placesOf(scope: string, format: Format): Array<string | null> {
    const seats = scope === DAY ? { day: variant.seats.day, matches: {} } : variant.seats
    return matchLineup(seats, { id: scope, formats: [format] })[format]!
  }

  function setPlaces(scope: string, format: Format, places: Array<string | null>) {
    const seats: PlanVariant = { day: { ...variant.seats.day }, matches: { ...variant.seats.matches } }
    if (scope === DAY) seats.day[format] = places
    else seats.matches[scope] = { ...seats.matches[scope], [format]: places }
    saveSeats(seats)
  }

  // A player put on a place: within the same lineup of a format the two swap, from the kader or
  // another format the player is added and keeps their other places
  function place(scope: string, format: Format, index: number, held: Held) {
    setPicked(null)
    const places = placesOf(scope, format)
    if (places[index] === held.playerId) return
    setPlaces(scope, format, placePlayer({ [format]: places }, format, index, held.playerId)[format]!)
  }

  function clear(scope: string, format: Format, index: number) {
    setPicked(null)
    setPlaces(scope, format, placePlayer({ [format]: placesOf(scope, format) }, format, index, null)[format]!)
  }

  // A player dragged from a place back onto the kader leaves that place
  function takeBack(held: Held) {
    setPicked(null)
    if (!held.from) return
    const places = placesOf(held.from.scope, held.from.format)
    const index = places.indexOf(held.playerId)
    if (index >= 0) clear(held.from.scope, held.from.format, index)
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

  const readHeld = (e: React.DragEvent): Held | null => {
    try {
      return JSON.parse(e.dataTransfer.getData("text/plain")) as Held
    } catch {
      return dragging
    }
  }

  const dragProps = (held: Held) => ({
    draggable: !busy,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(held))
      e.dataTransfer.effectAllowed = "move"
      setDragging(held)
    },
    onDragEnd: () => {
      setDragging(null)
      setDragOver(null)
    },
  })

  const dropProps = (target: string, onHeld: (held: Held) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(target)
    },
    onDragLeave: () => setDragOver((t) => (t === target ? null : t)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(null)
      setDragging(null)
      const held = readHeld(e)
      if (held) onHeld(held)
    },
  })

  // One place of a lineup: takes a dragged or tapped player, and can itself be dragged elsewhere
  function seat(scope: string, format: Format, index: number, places: Array<string | null>) {
    const playerId = places[index]
    const target = `${scope}:${format}:${index}`
    const out = playerId && answers[playerId] === "OUT"
    const absent = playerId && scope !== DAY && plan.absences.some((a) => a.playerId === playerId && a.matchId === scope)
    const isPicked = picked?.playerId === playerId && picked?.from?.scope === scope && picked.from.format === format
    return (
      <div
        key={index}
        {...dropProps(target, (held) => place(scope, format, index, held))}
        onClick={() => {
          if (picked && !isPicked) place(scope, format, index, picked)
          else if (playerId) setPicked(isPicked ? null : { playerId, from: { scope, format } })
        }}
        className={cn(
          "flex h-10 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors",
          playerId ? "border-line bg-raised text-fg" : "border-dashed border-line-strong text-fg-subtle",
          (out || absent) && "border-danger/60 text-danger",
          dragOver === target && "border-brand bg-brand/10",
          picked && !isPicked && "hover:border-brand/60",
          isPicked && "ring-2 ring-brand"
        )}
      >
        {playerId ? (
          <>
            <span {...dragProps({ playerId, from: { scope, format } })} className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 active:cursor-grabbing">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", answers[playerId] ? DOT[answers[playerId]] : "bg-fg-subtle")} />
              <span className="truncate">{nameOf(playerId)}</span>
              {(out || absent) && <AlertTriangle size={12} className="shrink-0" />}
            </span>
            <button
              type="button"
              aria-label={`Remove ${nameOf(playerId)} from ${formatLabel(format)}`}
              onClick={(e) => {
                e.stopPropagation()
                clear(scope, format, index)
              }}
              className="-mr-1 shrink-0 rounded p-1 text-fg-subtle hover:text-danger"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <span className="truncate text-xs">{picked ? "Tap to place here" : "open"}</span>
        )}
      </div>
    )
  }

  // The formats a player drives on the day
  const dayFormatsOf = (playerId: string) => dayFormats.filter((f) => dayLineup[f]!.includes(playerId))

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

      {/* A board: the lineup on the left, the kader with its answers on the right to drag players from.
          On phones the kader comes first, and players are tapped instead of dragged. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <h2 className="section-title mb-1 flex items-center gap-2">
            <Users size={15} />
            Kader
          </h2>
          <p className="mb-3 text-xs text-fg-subtle">Set who is there, then drag players onto a place – or tap a player and then the place.</p>
          <Card {...dropProps("kader", takeBack)} className={cn("transition-colors", dragOver === "kader" && dragging?.from && "border-brand bg-brand/5")}>
            <CardContent className="divide-y divide-line p-0">
              {plan.kader.map((player) => {
                const entry = plan.answers[player.id]
                const isOut = entry?.answer === "OUT"
                const isPicked = picked?.playerId === player.id && !picked.from
                const placed = dayFormatsOf(player.id)
                return (
                  <div key={player.id} className="space-y-2 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        {...(isOut ? {} : dragProps({ playerId: player.id }))}
                        disabled={isOut}
                        onClick={() => setPicked(isPicked ? null : { playerId: player.id })}
                        title={isOut ? "Out – cannot be placed" : "Drag onto a place, or tap and then tap the place"}
                        className={cn(
                          "inline-flex min-w-0 max-w-full flex-1 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-sm font-medium transition-colors",
                          isOut ? "cursor-not-allowed border-transparent text-fg-subtle line-through" : "cursor-grab border-line bg-raised text-fg active:cursor-grabbing",
                          isPicked && "ring-2 ring-brand"
                        )}
                      >
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", entry?.answer ? DOT[entry.answer] : "bg-fg-subtle")} />
                        <span className="truncate">{player.name}</span>
                        {placed.length > 0 && <span className="ml-auto shrink-0 text-[10px] font-normal text-fg-subtle">{placed.map(formatLabel).join(" ")}</span>}
                      </button>
                      <div className="flex shrink-0 gap-1" role="group" aria-label={`Answer of ${player.name}`}>
                        {ANSWERS.map((a) => {
                          const on = entry?.answer === a.value
                          return (
                            <button
                              key={a.value}
                              type="button"
                              aria-pressed={on}
                              disabled={busy}
                              // A second tap on the chosen answer takes it back
                              onClick={() => send({ action: "answer", playerId: player.id, answer: on ? null : a.value })}
                              className={cn(
                                "rounded-full border px-2 py-1 text-xs transition-colors md:py-0.5",
                                on ? a.on : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                              )}
                            >
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <Input
                      key={`${player.id}:${entry?.note ?? ""}`}
                      aria-label={`Note on ${player.name}`}
                      placeholder="Note, e.g. only until 22:00"
                      defaultValue={entry?.note ?? ""}
                      className="h-8 border-dashed text-xs"
                      onBlur={(e) => {
                        const note = e.target.value.trim()
                        if (note !== (entry?.note ?? "")) void send({ action: "answer", playerId: player.id, answer: entry?.answer ?? null, note })
                      }}
                    />
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

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          {/* The tapped player, waiting for a place; stays in view while scrolling on a phone */}
          {picked && (
            <div className="sticky top-16 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-brand/15 px-3 py-2 text-xs text-brand-ink backdrop-blur md:top-2">
              <span className="min-w-0 flex-1">
                <strong>{nameOf(picked.playerId)}</strong> selected – tap a place to put them there
              </span>
              <button type="button" onClick={() => setPicked(null)} className="font-medium hover:underline">Cancel</button>
            </div>
          )}

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
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {dayLineup[format]!.map((_, i) => seat(DAY, format, i, dayLineup[format]!))}
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
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {lineup[format]!.map((_, i) => seat(match.id, format, i, lineup[format]!))}
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
