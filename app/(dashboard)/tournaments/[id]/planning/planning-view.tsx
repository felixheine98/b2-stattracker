"use client"

import { VariantsBoard } from "./variants-board"
import { GuestBadge } from "@/components/guest-badge"
import { AvailabilityInput, answerColor } from "@/components/planning/availability-input"
import { AVAILABILITY_LABEL, type Answer } from "@/lib/planning"
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
import { useState } from "react"

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
  const tab = variants && (tabParam === "variants" || tabParam === "varianten") ? "variants" : "availability"
  const selectTab = (next: "variants" | "availability") =>
    window.history.replaceState(null, "", next === "variants" ? "?tab=variants" : window.location.pathname)
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
  type Row = (typeof rows)[number]
  const ownRow = rows.find((r) => r.player.id === ownPlayerId)
  const groups = [
    { answer: "FIX" as Answer, label: AVAILABILITY_LABEL.FIX },
    { answer: "MAYBE" as Answer, label: AVAILABILITY_LABEL.MAYBE },
    ...levels.map((l) => ({ answer: `level:${l.id}` as Answer, label: l.name })),
    { answer: "OUT" as Answer, label: AVAILABILITY_LABEL.OUT },
    { answer: "OPEN" as Answer, label: "No answer yet" },
  ].map((g) => ({ ...g, rows: rows.filter((r) => r.answer === g.answer) }))

  const rowName = (row: Row) => (
    <div className="flex min-w-0 items-center gap-2 md:w-52 md:shrink-0">
      <PlayerAvatar player={row.player} />
      <span className="truncate text-sm font-medium text-[#f5f0f0]">{row.player.name}</span>
      {row.guest && <GuestBadge />}
      {row.player.id === ownPlayerId && <span className="text-xs text-[#FBD00D]">you</span>}
      {layout === "list" && canManage && !archived && row.guest && (
        <button
          type="button"
          onClick={() => call(`/entries/${row.player.id}`, "DELETE")}
          title="Take off the list"
          className="ml-auto text-[#5e5858] hover:text-[#ED1F24] md:ml-0"
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
      note={row.note}
      levels={levels}
      editable={!archived && (canManage || row.player.id === ownPlayerId)}
      mutate={mutate}
      className={className}
    />
  )

  async function addLevel(e: React.FormEvent) {
    e.preventDefault()
    if (levelName.trim() && (await call("/levels", "POST", { name: levelName.trim() }))) setLevelName("")
  }

  return (
    <div className={cn("space-y-6", tab === "variants" ? "max-w-7xl" : "max-w-4xl")}>
      <div>
        <Link href={tournamentPath(tournament)} className="mb-4 inline-flex items-center gap-1 text-sm text-[#9a9090] hover:text-[#f5f0f0]">
          <ArrowLeft size={14} />
          {tournament.name}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-[#f5f0f0]">Planning</h1>
          {presence.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-[#9a9090]">
              here right now:
              {presence.map((p) => (
                <span key={p.userId} className="rounded-full border border-[#6b8fff]/40 bg-[#6b8fff]/15 px-2 py-0.5 text-[#6b8fff]">{p.name}</span>
              ))}
            </p>
          )}
        </div>
        <p className="mt-0.5 text-sm text-[#9a9090]">
          {rows.length} on the list, {open} without an answer
        </p>
      </div>

      {archived && (
        <p className="rounded-lg border border-[#2d2829] bg-[#1c1819] px-4 py-2.5 text-sm text-[#c5bfbf]">
          This planning is closed: the tournament has its lineups. Nothing can be changed here any more.
          {adoptedName && <> “{adoptedName}” was taken over.</>}
        </p>
      )}

      {variants && (
        <div className="inline-flex rounded-lg border border-[#2d2829] p-1" role="tablist">
          {([
            ["availability", "Availability"],
            ["variants", `Variants (${variants.length})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => selectTab(value)}
              className={cn(
                "whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === value ? "bg-[#FBD00D]/15 text-[#FBD00D]" : "text-[#9a9090] hover:text-[#f5f0f0]"
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
        <>
      {canManage && !archived && (
        <div className="space-y-2 rounded-xl border border-[#2d2829] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Extra levels</h2>
          <p className="text-xs text-[#5e5858]">
            Next to “Available”, “Maybe” and “Not available”, for this planning only – e.g. “stand-in only”.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {levels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#6b8fff]/40 bg-[#6b8fff]/15 py-1 pl-3 pr-2 text-xs text-[#6b8fff]">
                {l.name}
                <button
                  type="button"
                  onClick={() => { if (confirm(`Remove the level “${l.name}”? Whoever chose it is without an answer again.`)) call(`/levels/${l.id}`, "DELETE") }}
                  aria-label={`Remove ${l.name}`}
                  className="hover:text-[#ED1F24]"
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

      {error && <p className="text-sm text-[#ED1F24]">{error}</p>}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Availability</h2>
          <div className="inline-flex rounded-lg border border-[#2d2829] p-0.5" role="tablist" aria-label="Layout of the list">
            {([["groups", "Groups"], ["list", "List"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={layout === value}
                onClick={() => setLayout(value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  layout === value ? "bg-[#FBD00D]/15 text-[#FBD00D]" : "text-[#9a9090] hover:text-[#f5f0f0]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 && <p className="rounded-xl border border-[#2d2829] px-4 py-6 text-center text-sm text-[#5e5858]">Nobody on the list yet.</p>}

        {layout === "list" ? (
          rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[#2d2829]">
              {/* The viewer's own row first, the others by name */}
              {[...rows].sort((a, b) => Number(b.player.id === ownPlayerId) - Number(a.player.id === ownPlayerId)).map((row, i) => (
                <div
                  key={row.player.id}
                  className={cn(
                    "flex flex-col gap-2 px-3.5 py-3 md:flex-row md:items-center md:gap-4",
                    i > 0 && "border-t border-[#2d2829]",
                    row.player.id === ownPlayerId ? "bg-[#FBD00D]/5" : i % 2 === 0 ? "bg-[#1c1819]" : "bg-[#1c1819]/60"
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
              <div className="flex flex-col gap-2 rounded-xl border border-[#FBD00D]/30 bg-[#FBD00D]/5 px-3.5 py-3 md:flex-row md:items-center md:gap-4">
                {rowName(ownRow)}
                {rowInput(ownRow)}
              </div>
            )}
            {/* Everyone sorted into their answer: who is in, who is not, who has yet to say */}
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <section key={group.answer} className="overflow-hidden rounded-xl border border-[#2d2829] bg-[#1c1819]">
                  <h3 className={cn("flex items-center justify-between border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider", answerColor(group.answer))}>
                    {group.label}
                    <span className="font-mono">{group.rows.length}</span>
                  </h3>
                  {group.rows.length === 0 && <p className="px-3 py-2 text-xs text-[#5e5858]">nobody</p>}
                  <ul>
                    {group.rows.map((row) => {
                      const own = row.player.id === ownPlayerId
                      const editable = !archived && (canManage || own)
                      return (
                        <li key={row.player.id} className="border-t border-[#2d2829]/60 first:border-0">
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => setEditing(editing === row.player.id ? null : row.player.id)}
                            aria-expanded={editable ? editing === row.player.id : undefined}
                            title={editable ? "Change answer" : undefined}
                            className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", editable && "hover:bg-[#251f20]", own && "bg-[#FBD00D]/5")}
                          >
                            <PlayerAvatar player={row.player} className="h-5 w-5 text-[10px]" />
                            <span className="min-w-0 truncate text-[#f5f0f0]">{row.player.name}</span>
                            {row.guest && <GuestBadge />}
                            {own && <span className="text-xs text-[#FBD00D]">you</span>}
                            {row.note && <span className="ml-auto min-w-0 max-w-[55%] truncate text-xs text-[#9a9090]" title={row.note}>{row.note}</span>}
                          </button>
                          {editable && editing === row.player.id && (
                            <div className="space-y-2 border-t border-[#2d2829]/60 bg-[#0e0c0d] px-3 py-2.5">
                              {/* Stacked: a group is too narrow for buttons and note side by side */}
                              {rowInput(row, "md:flex-col md:items-stretch")}
                              {canManage && row.guest && (
                                <button type="button" onClick={() => call(`/entries/${row.player.id}`, "DELETE")} className="text-xs text-[#5e5858] hover:text-[#ED1F24]">
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Add a guest</h2>
          <PlayerSearch
            players={addable}
            isGuest={() => true}
            onPick={(id) => call(`/entries/${id}`, "PUT", {})}
            placeholder="Find a guest, Enter adds them to the list"
            emptyText="No guest found."
          />
        </div>
      )}
        </>
      )}
    </div>
  )
}
