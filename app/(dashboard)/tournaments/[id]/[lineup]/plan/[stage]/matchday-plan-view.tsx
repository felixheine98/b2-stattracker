"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Copy, Pencil, Plus, StickyNote, Trash2, Users } from "lucide-react"
import { PlayerAvatar } from "@/components/player-avatar"
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
  seatSuggestions,
  placePlayer,
  type MatchdayAnswer,
  type PlanHint,
  type PlanVariant,
  type Seats,
} from "@/lib/matchday-plan"
import type { LoadedPlan } from "@/lib/matchday-plan-db"
import { formatDay, formatDayMonth } from "@/lib/player-status"
import { cn, formatLabel } from "@/lib/utils"
import type { Format } from "@/types"
import { SeatInput } from "./seat-input"
import { PlayerName } from "@/components/player-name"
import { shownName } from "@/lib/player-names"
import { MatchdayDiscord } from "@/components/planning/matchday-discord"
import { answersRevision } from "@/lib/matchday-discord"

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
  // Whether the answers can come from the lineup channel's Discord ping
  discord: boolean
  // Every match day and playoff day to switch to, in order
  days: Array<{ id: string; name: string; day: string; href: string; current: boolean }>
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

export function MatchdayPlanView({ initial, apiPath, title, links, dayFormats, days, discord }: Props) {
  const [plan, setPlan] = useState<Plan>(initial)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  // The kader stays one line per player; a note field only opens when there is a note or one is being written
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [variantId, setVariantId] = useState(initial.publishedVariantId ?? initial.variants[0]?.id)
  const variant = plan.variants.find((v) => v.id === variantId) ?? plan.variants[0]

  const answerOf = (playerId: string) => plan.answers[playerId]?.answer ?? undefined
  const answers = Object.fromEntries(plan.kader.map((p) => [p.id, answerOf(p.id)]))
  const playerOf = (playerId: string) => plan.kader.find((p) => p.id === playerId)
  const nameOf = (playerId: string) => {
    const player = playerOf(playerId)
    return player ? shownName(player) : "Unknown"
  }
  const dotOf = (playerId: string) => (answers[playerId] ? DOT[answers[playerId]] : "bg-fg-subtle")
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

  // The planning as it is now, after answers came in from Discord
  async function reload() {
    const res = await fetch(`${BASE_PATH}${apiPath}`, { cache: "no-store" })
    if (res.ok) setPlan(await res.json())
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

  // A player typed into a place
  function place(scope: string, format: Format, index: number, playerId: string | null) {
    setPlaces(scope, format, placePlayer({ [format]: placesOf(scope, format) }, format, index, playerId)[format]!)
  }

  // The map of a format on this match day, the same for every lineup
  async function saveMap(format: Format, name: string) {
    if (name === (plan.maps[format] ?? "")) return
    await send({ action: "maps", maps: { ...plan.maps, [format]: name } })
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

  // One place of a lineup, filled by typing a name
  function seat(scope: string, format: Format, index: number, places: Array<string | null>) {
    const playerId = places[index]
    const out = !!playerId && answers[playerId] === "OUT"
    const absent = !!playerId && scope !== DAY && plan.absences.some((a) => a.playerId === playerId && a.matchId === scope)
    return (
      <SeatInput
        key={index}
        label={`${formatLabel(format)} place ${index + 1}`}
        player={playerId ? (playerOf(playerId) ?? { id: playerId, name: "Unknown", country: null }) : null}
        suggest={(query) => seatSuggestions(query, plan.kader, answers, places.filter((_, i) => i !== index))}
        dot={dotOf}
        warn={out || absent}
        disabled={busy}
        onPick={(id) => place(scope, format, index, id)}
        onClear={() => place(scope, format, index, null)}
      />
    )
  }

  // A format with its map, e.g. "1v1 · Heat"
  const formatWithMap = (format: Format) => (plan.maps[format] ? `${formatLabel(format)} · ${plan.maps[format]}` : formatLabel(format))

  // The formats a player drives on the day

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
        <nav aria-label="Match days" className="mt-4 flex flex-wrap gap-2">
          {days.map((d) => (
            <Link
              key={d.id}
              href={d.href}
              aria-current={d.current ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                d.current ? "border-brand bg-brand/15 text-brand-ink" : "border-line bg-raised text-fg-soft hover:border-line-strong hover:text-fg"
              )}
            >
              {d.name} <span className={cn("text-xs", d.current ? "text-brand-ink/80" : "text-fg-subtle")}>{formatDayMonth(d.day)}</span>
            </Link>
          ))}
        </nav>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      {/* The lineup on the left, typed in place by place; the kader with its answers on the right.
          On phones the kader comes first, as the answers are set before the lineup. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <h2 className="section-title mb-1 flex items-center gap-2">
            <Users size={15} />
            Kader
          </h2>
          <p className="mb-3 text-xs text-fg-subtle">Set who is there, then type the players into the places of the lineup.</p>
          {discord && (
            <div className="mb-3">
              <MatchdayDiscord
                apiPath={apiPath}
                channelId={plan.discordChannelId}
                settings={plan.discordSettings}
                kader={plan.kader}
                answers={Object.fromEntries(plan.kader.map((p) => [p.id, answerOf(p.id) ?? null]))}
                revision={answersRevision(Object.fromEntries(plan.kader.map((p) => [p.id, answerOf(p.id) ?? null])))}
                onApplied={reload}
                stage={title.stage}
                day={plan.matches.find((m) => m.date)?.date?.toString() ?? title.day}
              />
            </div>
          )}
          <Card>
            <CardContent className="divide-y divide-line p-0">
              {plan.kader.map((player) => {
                const entry = plan.answers[player.id]
                const isOut = entry?.answer === "OUT"
                return (
                  <div key={player.id} className="space-y-1.5 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={cn("flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium", isOut ? "text-fg-subtle line-through" : "text-fg")}>
                        <PlayerAvatar player={player} className="h-4 w-4 text-[9px]" />
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotOf(player.id))} />
                        <span className="truncate"><PlayerName name={player.name} nickname={player.nickname} /></span>
                      </div>
                      <div className="flex shrink-0 gap-1" role="group" aria-label={`Answer of ${shownName(player)}`}>
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
                        {!entry?.note && noteOpen !== player.id && (
                          <button
                            type="button"
                            aria-label={`Add a note on ${shownName(player)}`}
                            title="Add a note"
                            onClick={() => setNoteOpen(player.id)}
                            className="rounded-full border border-transparent px-1.5 py-1 text-fg-subtle hover:text-fg md:py-0.5"
                          >
                            <StickyNote size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    {(entry?.note || noteOpen === player.id) && (
                      <Input
                        key={`${player.id}:${entry?.note ?? ""}`}
                        aria-label={`Note on ${shownName(player)}`}
                        placeholder="Note, e.g. only until 22:00"
                        defaultValue={entry?.note ?? ""}
                        autoFocus={noteOpen === player.id}
                        className="h-7 border-dashed text-xs"
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                        onBlur={(e) => {
                          setNoteOpen(null)
                          const note = e.target.value.trim()
                          if (note !== (entry?.note ?? "")) void send({ action: "answer", playerId: player.id, answer: entry?.answer ?? null, note })
                        }}
                      />
                    )}
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
            <p className="mb-3 text-xs text-fg-subtle">Every match of the day follows it, unless a match has a lineup of its own for a format. The map of a format holds for every lineup of the match day.</p>
            <Card>
              <CardContent className="space-y-3 pt-5">
                {dayFormats.map((format) => (
                  <div key={format} className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-8 shrink-0 text-sm font-semibold text-fg">{formatLabel(format)}</span>
                      <Input
                        key={`${format}:${plan.maps[format] ?? ""}`}
                        aria-label={`Map of ${formatLabel(format)}`}
                        placeholder="Map"
                        defaultValue={plan.maps[format] ?? ""}
                        maxLength={60}
                        disabled={busy}
                        className="h-8 min-w-0 flex-1 border-dashed text-xs"
                        onBlur={(e) => void saveMap(format, e.target.value.trim())}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
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
                          <div key={format} className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
                            <span className="truncate text-sm font-semibold text-fg">{formatWithMap(format)}</span>
                            {isOwn ? (
                              <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                                {lineup[format]!.map((_, i) => seat(match.id, format, i, lineup[format]!))}
                              </div>
                            ) : (
                              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-soft">
                                {lineup[format]!.map((id, i) => {
                                  const player = id ? playerOf(id) : undefined
                                  return (
                                    <span key={i} className="inline-flex items-center gap-1">
                                      {player && <PlayerAvatar player={player} className="h-4 w-4 text-[9px]" />}
                                      {id ? nameOf(id) : "—"}
                                    </span>
                                  )
                                })}
                                <span className="text-xs text-fg-subtle">day lineup</span>
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
