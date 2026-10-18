"use client"

import { VariantsBoard } from "./variants-board"
import { DiscordImport } from "@/components/planning/discord-import"
import { GuestBadge } from "@/components/guest-badge"
import { AvailabilityInput, answerColor } from "@/components/planning/availability-input"
import { AVAILABILITY_LABEL, INACTIVE_LABEL, type Answer } from "@/lib/planning"
import { PlayerAvatar } from "@/components/player-avatar"
import { PlayerSearch } from "@/components/player-search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BASE_PATH } from "@/lib/base-path"
import { tournamentPath } from "@/lib/paths"
import { cn } from "@/lib/utils"
import { ArrowLeft, Plus, X } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { PlanningState } from "@/lib/planning-db"
import type { Activity } from "@/lib/planning-presence"
import { usePlanningLive } from "@/lib/use-planning-live"
import { useLayoutEffect, useRef, useState } from "react"

interface Props {
  initial: PlanningState
  ownPlayerId: string | null
  userId: string
  canManage: boolean
}

const IDLE: Activity = { variantId: null, playerId: null, typing: null }

export function PlanningView({ initial, ownPlayerId, userId, canManage }: Props) {
  // What this viewer is doing on the board, shared with the other managers
  const [activity, setActivity] = useState<Activity>(IDLE)
  const { state, presence, mutate } = usePlanningLive(initial, activity)
  const { tournament, levels, rows, addable, variants, archived, adoptedVariantId } = state
  // The tab lives in the address, so a reload or shared link opens the same one
  const tabParam = useSearchParams().get("tab")
  // The tab is called "Lineups"; its former names still lead to it
  const tab = variants && ["lineups", "variants", "varianten"].includes(tabParam ?? "") ? "variants" : "availability"
  const selectTab = (next: "variants" | "availability") =>
    window.history.replaceState(null, "", next === "variants" ? "?tab=lineups" : window.location.pathname)
  const [levelName, setLevelName] = useState("")
  const [error, setError] = useState("")
  const api = `${BASE_PATH}/api/tournaments/${tournament.id}/planning`
  const adoptedName = variants?.find((v) => v.id === adoptedVariantId)?.name
  const open = rows.filter((r) => r.answer === "OPEN").length

  async function call(path: string, method: string, body?: unknown) {
    setError("")
    const failed = await mutate(
      (s) => s,
      () => fetch(`${api}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    )
    if (failed) setError(failed)
    return !failed
  }

  // The availability either as groups by answer (short, to see who is in) or as one row per player
  const [layout, setLayout] = useState<"groups" | "list">("groups")
  // Player whose answer is being changed inside a group
  const [editing, setEditing] = useState<string | null>(null)
  const answerMenuRef = useRef<HTMLDivElement>(null)

  // Expanding the last row adds content below the viewport. Reveal it in the
  // nearest scroll container, without moving a menu that is already visible.
  useLayoutEffect(() => {
    answerMenuRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" })
  }, [editing, layout])
  type Row = (typeof rows)[number]
  const ownRow = rows.find((r) => r.player.id === ownPlayerId)
  const groups = [
    { answer: "FIX" as Answer, label: AVAILABILITY_LABEL.FIX },
    { answer: "MAYBE" as Answer, label: AVAILABILITY_LABEL.MAYBE },
    ...levels.map((l) => ({ answer: `level:${l.id}` as Answer, label: l.name })),
    { answer: "OUT" as Answer, label: AVAILABILITY_LABEL.OUT },
    { answer: "INACTIVE" as Answer, label: INACTIVE_LABEL },
    { answer: "OPEN" as Answer, label: "No answer yet" },
  ].map((g) => ({ ...g, rows: rows.filter((r) => r.answer === g.answer) }))

  const rowName = (row: Row) => (
    <div className="flex min-w-0 items-center gap-2 md:w-52 md:shrink-0">
      <PlayerAvatar player={row.player} />
      <span className="truncate text-sm font-medium text-fg">{row.player.name}</span>
      {row.guest && <GuestBadge />}
      {row.answer === "INACTIVE" && (
        <span title="Does not drive competitions as a rule. An answer for this tournament still counts." className="shrink-0 rounded-full border border-violet/40 bg-violet/15 px-1.5 py-px text-[10px] font-medium leading-4 text-violet">
          {INACTIVE_LABEL}
        </span>
      )}
      {row.player.id === ownPlayerId && <span className="text-xs text-brand-ink">you</span>}
      {layout === "list" && canManage && !archived && row.guest && (
        <button
          type="button"
          onClick={() => call(`/entries/${row.player.id}`, "DELETE")}
          title="Take off the list"
          className="ml-auto text-fg-subtle hover:text-danger md:ml-0"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )

  const rowInput = (row: Row, className = "flex-1") => (
    <AvailabilityInput
      // A fresh input whenever the levels change, as a removed level resets answers
      key={levels.map((l) => l.id).join()}
      tournamentId={tournament.id}
      playerId={row.player.id}
      answer={row.answer}
      inactive={row.inactive}
      inactiveNextToName
      note={row.note}
      levels={levels}
      editable={!archived && (canManage || row.player.id === ownPlayerId)}
      mutate={mutate}
      // In the groups the answer is chosen in a menu below the name: once the player has moved, it closes
      onSaved={(change) => { if (change.answer !== undefined) setEditing((open) => (open === row.player.id ? null : open)) }}
      className={className}
    />
  )

  async function addLevel(e: React.FormEvent) {
    e.preventDefault()
    if (levelName.trim() && (await call("/levels", "POST", { name: levelName.trim() }))) setLevelName("")
  }

  return (
    <div className="space-y-6 page-wide">
      <div>
        <Link href={tournamentPath(tournament)} className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft size={14} />
          {tournament.name}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-fg">Planning</h1>
          {presence.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
              here right now:
              {presence.map((p) => (
                <span key={p.userId} className="rounded-full border border-info/40 bg-info/15 px-2 py-0.5 text-info">{p.name}</span>
              ))}
            </p>
          )}
        </div>
        <p className="mt-0.5 text-sm text-fg-muted">
          {rows.length} on the list, {open} without an answer
        </p>
      </div>

      {archived && (
        <p className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-fg-soft">
          This planning is closed: the tournament has its lineups. Nothing can be changed here any more.
          {adoptedName && <> “{adoptedName}” was taken over.</>}
        </p>
      )}

      {canManage && !archived && tab === "availability" && <DiscordImport state={state} mutate={mutate} />}

      {variants && (
        <div className="inline-flex rounded-lg border border-line p-1" role="tablist">
          {([
            ["availability", "Availability"],
            ["variants", `Lineups (${variants.length})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => selectTab(value)}
              className={cn(
                "whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === value ? "bg-brand/15 text-brand-ink" : "text-fg-muted hover:text-fg"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {variants && tab === "variants" ? (
        <VariantsBoard
          tournamentId={tournament.id}
          tournamentHref={tournamentPath(tournament)}
          rows={rows}
          levels={levels}
          variants={variants}
          userId={userId}
          archived={archived}
          adoptedVariantId={adoptedVariantId}
          mutate={mutate}
          presence={presence}
          onActivity={setActivity}
        />
      ) : (
        // From 1536px on the list stands on the left, what only managers need on the right
        <div className="page-columns">
      {canManage && !archived && (
        <div className="space-y-2 rounded-xl border border-line p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Extra levels</h2>
          <p className="text-xs text-fg-subtle">
            Next to “Available”, “Maybe” and “Not available”, for this planning only – e.g. “stand-in only”.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {levels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border border-bronze/40 bg-bronze/15 py-1 pl-3 pr-2 text-xs text-bronze">
                {l.name}
                <button
                  type="button"
                  onClick={() => { if (confirm(`Remove the level “${l.name}”? Whoever chose it is without an answer again.`)) call(`/levels/${l.id}`, "DELETE") }}
                  aria-label={`Remove ${l.name}`}
                  className="hover:text-danger"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <form onSubmit={addLevel} className="flex items-center gap-2">
              <Input value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder="New level" maxLength={30} className="h-8 w-36 text-xs" />
              <Button type="submit" size="sm" variant="outline" disabled={!levelName.trim()}>
                <Plus size={14} />
                Add
              </Button>
            </form>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="page-main">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Availability</h2>
          <div className="inline-flex rounded-lg border border-line p-0.5" role="tablist" aria-label="Layout of the list">
            {([["groups", "Groups"], ["list", "List"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={layout === value}
                onClick={() => setLayout(value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  layout === value ? "bg-brand/15 text-brand-ink" : "text-fg-muted hover:text-fg"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 && <p className="rounded-xl border border-line px-4 py-6 text-center text-sm text-fg-subtle">Nobody on the list yet.</p>}

        {layout === "list" ? (
          rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-line">
              {/* The viewer's own row first, the others by name */}
              {[...rows].sort((a, b) => Number(b.player.id === ownPlayerId) - Number(a.player.id === ownPlayerId)).map((row, i) => (
                <div
                  key={row.player.id}
                  className={cn(
                    "flex flex-col gap-2 px-3.5 py-3 md:flex-row md:items-center md:gap-4",
                    i > 0 && "border-t border-line",
                    row.player.id === ownPlayerId ? "bg-brand/5" : i % 2 === 0 ? "bg-surface" : "bg-surface/60"
                  )}
                >
                  {rowName(row)}
                  {rowInput(row)}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* The viewer's own answer stands apart at the top, ready to change */}
            {ownRow && (
              <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3.5 py-3 md:flex-row md:items-center md:gap-4">
                {rowName(ownRow)}
                {rowInput(ownRow)}
              </div>
            )}
            {/* Everyone sorted into their answer: who is in, who is not, who has yet to say */}
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5">
              {groups.map((group) => (
                <section key={group.answer} className="overflow-hidden rounded-xl border border-line bg-surface">
                  <h3 className={cn("flex items-center justify-between border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider", answerColor(group.answer))}>
                    {group.label}
                    <span className="font-mono">{group.rows.length}</span>
                  </h3>
                  {group.rows.length === 0 && <p className="px-3 py-2 text-xs text-fg-subtle">nobody</p>}
                  <ul>
                    {group.rows.map((row) => {
                      const own = row.player.id === ownPlayerId
                      const editable = !archived && (canManage || own)
                      return (
                        <li key={row.player.id} className="border-t border-line/60 first:border-0">
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => setEditing(editing === row.player.id ? null : row.player.id)}
                            aria-expanded={editable ? editing === row.player.id : undefined}
                            title={editable ? "Change answer" : undefined}
                            className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", editable && "hover:bg-raised", own && "bg-brand/5")}
                          >
                            <PlayerAvatar player={row.player} className="h-5 w-5 text-[10px]" />
                            <span className="min-w-0 truncate text-fg">{row.player.name}</span>
                            {row.guest && <GuestBadge />}
                            {own && <span className="text-xs text-brand-ink">you</span>}
                            {row.note && <span className="ml-auto min-w-0 max-w-[55%] truncate text-xs text-fg-muted" title={row.note}>{row.note}</span>}
                          </button>
                          {editable && editing === row.player.id && (
                            <div ref={answerMenuRef} className="scroll-m-3 space-y-2 border-t border-line/60 bg-canvas px-3 py-2.5">
                              {/* Stacked: a group is too narrow for buttons and note side by side */}
                              {rowInput(row, "md:flex-col md:items-stretch")}
                              {canManage && row.guest && (
                                <button type="button" onClick={() => call(`/entries/${row.player.id}`, "DELETE")} className="text-xs text-fg-subtle hover:text-danger">
                                  Take off the list
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      {canManage && !archived && addable.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Add a guest</h2>
          <PlayerSearch
            players={addable}
            isGuest={() => true}
            onPick={(id) => call(`/entries/${id}`, "PUT", {})}
            placeholder="Find a guest, Enter adds them to the list"
            emptyText="No guest found."
          />
        </div>
      )}
        </div>
      )}
    </div>
  )
}
