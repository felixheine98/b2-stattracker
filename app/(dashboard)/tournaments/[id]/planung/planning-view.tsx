"use client"

import { VariantsBoard } from "./variants-board"
import { GuestBadge } from "@/components/guest-badge"
import { AvailabilityInput } from "@/components/planning/availability-input"
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
  const tab = variants && tabParam === "varianten" ? "variants" : "availability"
  const selectTab = (next: "variants" | "availability") =>
    window.history.replaceState(null, "", next === "variants" ? "?tab=varianten" : window.location.pathname)
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
          <h1 className="text-2xl font-bold text-[#f5f0f0]">Planung</h1>
          {presence.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-[#9a9090]">
              gerade dabei:
              {presence.map((p) => (
                <span key={p.userId} className="rounded-full border border-[#6b8fff]/40 bg-[#6b8fff]/15 px-2 py-0.5 text-[#6b8fff]">{p.name}</span>
              ))}
            </p>
          )}
        </div>
        <p className="mt-0.5 text-sm text-[#9a9090]">
          {rows.length} auf der Liste, {open} offen
        </p>
      </div>

      {archived && (
        <p className="rounded-lg border border-[#2d2829] bg-[#1c1819] px-4 py-2.5 text-sm text-[#c5bfbf]">
          Diese Planung ist abgeschlossen: Die Comp hat ihre Lineups. Hier lässt sich nichts mehr ändern.
          {adoptedName && <> Übernommen wurde „{adoptedName}“.</>}
        </p>
      )}

      {variants && (
        <div className="inline-flex rounded-lg border border-[#2d2829] p-1" role="tablist">
          {([
            ["availability", "Verfügbarkeit"],
            ["variants", `Varianten (${variants.length})`],
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Zusätzliche Stufen</h2>
          <p className="text-xs text-[#5e5858]">
            Neben „fix dabei“, „vielleicht“ und „nicht dabei“, nur für diese Planung – z. B. „nur Ersatz“.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {levels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#6b8fff]/40 bg-[#6b8fff]/15 py-1 pl-3 pr-2 text-xs text-[#6b8fff]">
                {l.name}
                <button
                  type="button"
                  onClick={() => { if (confirm(`Stufe „${l.name}“ entfernen? Wer sie gewählt hat, ist danach wieder offen.`)) call(`/levels/${l.id}`, "DELETE") }}
                  aria-label={`${l.name} entfernen`}
                  className="hover:text-[#ED1F24]"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <form onSubmit={addLevel} className="flex items-center gap-2">
              <Input value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder="Neue Stufe" maxLength={30} className="h-8 w-36 text-xs" />
              <Button type="submit" size="sm" variant="outline" disabled={!levelName.trim()}>
                <Plus size={14} />
                Hinzufügen
              </Button>
            </form>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[#ED1F24]">{error}</p>}

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Verfügbarkeit</h2>
        <div className="overflow-hidden rounded-xl border border-[#2d2829]">
          {rows.map((row, i) => {
            const own = row.player.id === ownPlayerId
            return (
              <div
                key={row.player.id}
                className={cn(
                  "flex flex-col gap-2 px-3.5 py-3 md:flex-row md:items-center md:gap-4",
                  i > 0 && "border-t border-[#2d2829]",
                  own ? "bg-[#FBD00D]/5" : i % 2 === 0 ? "bg-[#1c1819]" : "bg-[#1c1819]/60"
                )}
              >
                <div className="flex min-w-0 items-center gap-2 md:w-52 md:shrink-0">
                  <PlayerAvatar player={row.player} />
                  <span className="truncate text-sm font-medium text-[#f5f0f0]">{row.player.name}</span>
                  {row.guest && <GuestBadge />}
                  {own && <span className="text-xs text-[#FBD00D]">du</span>}
                  {canManage && !archived && row.guest && (
                    <button
                      type="button"
                      onClick={() => call(`/entries/${row.player.id}`, "DELETE")}
                      title="Von der Liste nehmen"
                      className="ml-auto text-[#5e5858] hover:text-[#ED1F24] md:ml-0"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <AvailabilityInput
                  // A fresh input whenever the levels change, as a removed level resets answers
                  key={levels.map((l) => l.id).join()}
                  tournamentId={tournament.id}
                  playerId={row.player.id}
                  answer={row.answer}
                  note={row.note}
                  levels={levels}
                  editable={!archived && (canManage || own)}
                  mutate={mutate}
                  className="flex-1"
                />
              </div>
            )
          })}
          {rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-[#5e5858]">Noch niemand auf der Liste.</p>}
        </div>
      </div>

      {canManage && !archived && addable.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Gast hinzufügen</h2>
          <PlayerSearch
            players={addable}
            isGuest={() => true}
            onPick={(id) => call(`/entries/${id}`, "PUT", {})}
            placeholder="Gast suchen, Enter fügt ihn zur Liste hinzu"
            emptyText="Kein Gast gefunden."
          />
        </div>
      )}
        </>
      )}
    </div>
  )
}
