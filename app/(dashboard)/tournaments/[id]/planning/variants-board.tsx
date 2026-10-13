"use client"

import { answerLabel, type LevelRef } from "@/components/planning/availability-input"
import { Button } from "@/components/ui/button"
import { BASE_PATH } from "@/lib/base-path"
import type { Answer } from "@/lib/planning"
import { adoptionPlan, applyAction, variantBoard, type VariantAction, type VariantData } from "@/lib/planning-variants"
import type { Activity, Present } from "@/lib/planning-presence"
import type { PlanningMutate } from "@/lib/use-planning-live"
import { cn } from "@/lib/utils"
import { AlertTriangle, Check, Copy, Plus, ThumbsUp, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export interface BoardRow {
  player: { id: string; tmId: string; name: string }
  answer: Answer
  guest: boolean
}

interface Props {
  tournamentId: string
  // The page of the tournament, where adopting a variant leads
  tournamentHref: string
  rows: BoardRow[]
  levels: LevelRef[]
  variants: VariantData[]
  userId: string
  // The tournament has its lineups: nothing can be changed any more
  archived: boolean
  // The variant the tournament's lineups were taken from
  adoptedVariantId: string | null
  mutate: PlanningMutate
  // The other managers on the page and what they are doing
  presence: Present[]
  // Reports what this viewer is doing: the player picked up and the note being typed
  onActivity: (activity: Activity) => void
}

const POOL = "pool"

function dotColor(answer: Answer): string {
  if (answer === "FIX") return "bg-green-400"
  if (answer === "MAYBE") return "bg-info"
  if (answer === "OUT") return "bg-danger"
  if (answer === "OPEN") return "bg-fg-subtle"
  if (answer === "INACTIVE") return "bg-violet"
  return "bg-bronze"
}

// A text field that saves when left or on Enter, not on every key
function SavingInput({ value, onSave, onLeave, className, ...props }: { value: string; onSave: (value: string) => void; onLeave?: () => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur">) {
  const [text, setText] = useState(value)
  const [previous, setPrevious] = useState(value)
  if (previous !== value) {
    setPrevious(value)
    setText(value)
  }
  return (
    <input
      {...props}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== value) onSave(text.trim())
        onLeave?.()
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
      className={cn("min-w-0 rounded-md border border-transparent bg-transparent focus:border-brand focus:outline-none", className)}
    />
  )
}

// The lineup variants, one below the other and kept low, so several fit on the screen for comparing.
// Each has a pool of players and its lineups. A player is moved by dragging (on a computer)
// or by tapping the player and then the target.
export function VariantsBoard({ tournamentId, tournamentHref, rows, levels, variants, userId, archived, adoptedVariantId, mutate, presence, onActivity }: Props) {
  const router = useRouter()
  const [adopting, setAdopting] = useState(false)
  // The tapped player, waiting for a target or a note
  const [selected, setSelected] = useState<{ variantId: string; playerId: string } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  // Asking how many lineups the new variant should have
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState("")

  // The player being dragged, and the note field being typed in
  const [dragging, setDragging] = useState<{ variantId: string; playerId: string } | null>(null)
  const [typing, setTyping] = useState<string | null>(null)
  const held = selected ?? dragging
  useEffect(() => {
    onActivity({ variantId: held?.variantId ?? typing?.split(":")[1] ?? null, playerId: held?.playerId ?? null, typing })
  }, [held?.variantId, held?.playerId, typing, onActivity])

  async function run(action: VariantAction) {
    setError("")
    // Shown at once; the server's state follows and is what counts
    const failed = await mutate(
      (s) => (s.variants ? { ...s, variants: applyAction(s.variants, action) } : s),
      () =>
        fetch(`${BASE_PATH}/api/tournaments/${tournamentId}/planning/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        })
    )
    if (failed) setError(failed)
  }

  // Take the variant over into the tournament; that closes the planning
  async function adopt(variant: VariantData) {
    const plan = adoptionPlan(variant, rows)
    if (plan.lineups.length === 0) {
      setError(`Nobody is placed in “${variant.name}” yet.`)
      return
    }
    const question = [
      `Take “${variant.name}” over into the tournament?`,
      "",
      ...plan.lineups.map((l) => `${l.name}: ${l.playerIds.length} players`),
      "",
      plan.empty.length > 0 && `Empty and not created: ${plan.empty.join(", ")}`,
      plan.unplaced > 0 && `${plan.unplaced} players stay without a lineup.`,
      plan.outCount > 0 && `Careful: ${plan.outCount} placed players are not available.`,
      "The planning is closed after that.",
    ].filter((line) => line !== false).join("\n")
    if (!confirm(question)) return
    setError("")
    setAdopting(true)
    const failed = await mutate(
      (s) => s,
      () =>
        fetch(`${BASE_PATH}/api/tournaments/${tournamentId}/planning/adopt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: variant.id }),
        })
    )
    setAdopting(false)
    if (failed) setError(failed)
    else router.push(tournamentHref)
  }

  // In the archive the adopted variant comes first
  const ordered = adoptedVariantId ? [...variants].sort((a, b) => Number(b.id === adoptedVariantId) - Number(a.id === adoptedVariantId)) : variants

  function place(variant: VariantData, playerId: string, target: string) {
    if (archived) return
    setSelected(null)
    const lineupId = target === POOL ? null : target
    const current = variant.lineups.find((l) => l.playerIds.includes(playerId))?.id ?? null
    if (current !== lineupId) run({ type: "placePlayer", variantId: variant.id, playerId, lineupId })
  }

  const newVariant = !archived && (
    <div className="flex flex-wrap items-center gap-2">
      {asking ? (
        <>
          <span className="text-sm text-fg-soft">How many lineups?</span>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Button key={n} size="sm" variant="outline" onClick={() => { setAsking(false); run({ type: "createVariant", lineupCount: n }) }} className="w-9 px-0">
              {n}
            </Button>
          ))}
          <button type="button" onClick={() => setAsking(false)} className="text-xs text-fg-subtle hover:text-fg">Cancel</button>
        </>
      ) : (
        <Button size="sm" variant={variants.length === 0 ? "default" : "outline"} onClick={() => setAsking(true)}>
          <Plus size={14} />
          {variants.length === 0 ? "Add the first variant" : "New variant"}
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {variants.length === 0 && <p className="text-sm text-fg-muted">No variant yet.</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {ordered.map((variant) => {
        const board = variantBoard(variant, rows)
        const adopted = variant.id === adoptedVariantId
        const voted = variant.votes.some((v) => v.userId === userId)
        const picked = selected?.variantId === variant.id ? rows.find((r) => r.player.id === selected.playerId) : undefined
        const others = presence.filter((p) => p.activity.variantId === variant.id)
        const holderOf = (playerId: string) => others.find((p) => p.activity.playerId === playerId)
        const typingHere = others.filter((p) => p.activity.typing?.split(":")[1] === variant.id)

        // A column takes the dragged or the tapped player
        const dropProps = (target: string) =>
          archived
            ? {}
            : {
                onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(`${variant.id}:${target}`) },
                onDragLeave: () => setDragOver((t) => (t === `${variant.id}:${target}` ? null : t)),
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault()
                  setDragOver(null)
                  // A player dragged over from another variant does not belong here
                  const [fromVariant, playerId] = e.dataTransfer.getData("text/plain").split(":")
                  if (fromVariant === variant.id && playerId) place(variant, playerId, target)
                },
                onClick: () => { if (picked) place(variant, picked.player.id, target) },
              }

        const area = (target: string) =>
          cn(
            "rounded-lg border px-3 py-3 transition-colors",
            target === POOL ? "border-dashed border-line-strong" : "border-line bg-surface",
            dragOver === `${variant.id}:${target}` && "border-brand bg-brand/5",
            picked && !archived && "cursor-pointer hover:border-brand/60"
          )

        const chip = (row: BoardRow & { note: string | null }, out = false) => {
          const isSelected = picked?.player.id === row.player.id
          const holder = holderOf(row.player.id)
          return (
            <button
              key={row.player.id}
              type="button"
              draggable={!archived}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `${variant.id}:${row.player.id}`)
                e.dataTransfer.effectAllowed = "move"
                setDragging({ variantId: variant.id, playerId: row.player.id })
              }}
              onDragEnd={() => setDragging(null)}
              onClick={(e) => {
                e.stopPropagation()
                if (!archived) setSelected(isSelected ? null : { variantId: variant.id, playerId: row.player.id })
              }}
              title={[answerLabel(row.answer, levels), row.guest ? "Guest" : "", out ? "no longer available" : "", row.note ?? ""].filter(Boolean).join(" · ")}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-raised px-2.5 py-1.5 text-sm transition-colors",
                out ? "border-danger/60 text-danger" : "border-line text-fg",
                isSelected && "ring-2 ring-brand",
                // Someone else has picked this player up
                holder && !isSelected && "ring-2 ring-info",
                !archived && "cursor-grab active:cursor-grabbing"
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor(row.answer))} />
              <span className="truncate">{row.player.name}</span>
              {out && <AlertTriangle size={11} className="shrink-0" />}
              {holder && <span className="shrink-0 rounded bg-info px-1 text-[10px] font-semibold text-canvas">{holder.name}</span>}
              {/* The note belongs to the player in this variant and stays wherever they are moved */}
              {row.note && <span className="max-w-[16ch] truncate text-[11px] text-fg-muted">{row.note}</span>}
            </button>
          )
        }

        return (
          <section key={variant.id} className={cn("space-y-4 rounded-xl border p-5", adopted ? "border-brand/60" : "border-line")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {archived ? (
                <h3 className="text-base font-semibold text-fg">{variant.name}</h3>
              ) : (
                <SavingInput
                  value={variant.name}
                  onSave={(name) => { if (name) run({ type: "updateVariant", variantId: variant.id, name }) }}
                  aria-label="Name of the variant"
                  maxLength={60}
                  className="h-8 w-48 max-w-full px-1.5 text-base font-semibold text-fg hover:border-line"
                />
              )}
              {adopted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-fg">
                  <Check size={12} />
                  Taken over
                </span>
              )}
              <button
                type="button"
                disabled={archived}
                aria-pressed={voted}
                onClick={() => run({ type: "vote", variantId: variant.id, on: !voted })}
                title={voted ? "Take the thumbs-up back" : "Vote for it"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  voted ? "border-brand/50 bg-brand/15 text-brand-ink" : "border-line-strong text-fg-muted hover:text-fg"
                )}
              >
                <ThumbsUp size={11} />
                {variant.votes.length > 0 ? variant.votes.map((v) => v.name).join(", ") : "In favour"}
              </button>
              {others.map((p) => (
                <span key={p.userId} className="rounded-full border border-info/40 bg-info/15 px-2 py-0.5 text-[11px] text-info">
                  {p.name}{typingHere.includes(p) ? " is typing…" : ""}
                </span>
              ))}
              {board.outCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-danger">
                  <AlertTriangle size={12} />
                  {board.outCount} nicht mehr dabei
                </span>
              )}
              {!archived && (
                <span className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={adopting} onClick={() => adopt(variant)} title="Create the lineups of this variant in the tournament" className="mr-1">
                    <Check size={14} />
                    Take over
                  </Button>
                  <button type="button" onClick={() => run({ type: "createVariant", copyFrom: variant.id })} title="Copy variant" className="p-1.5 text-fg-subtle hover:text-fg">
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (confirm(`Delete the variant “${variant.name}”?`)) run({ type: "deleteVariant", variantId: variant.id }) }}
                    title="Delete variant"
                    className="p-1.5 text-fg-subtle hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </div>

            {/* The tapped player: where to put them, and the note on them in this variant */}
            {picked && !archived && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs text-brand-ink">
                <span><strong>{picked.player.name}</strong> selected – tap where to put them</span>
                <SavingInput
                  key={picked.player.id}
                  value={variant.playerNotes[picked.player.id] ?? ""}
                  onSave={(note) => run({ type: "notePlayer", variantId: variant.id, playerId: picked.player.id, note: note || null })}
                  onFocus={() => setTyping(`player:${variant.id}:${picked.player.id}`)}
                  onLeave={() => setTyping(null)}
                  placeholder="Note on this player"
                  maxLength={300}
                  className="h-7 min-w-40 flex-1 border-dashed border-brand/40 px-2 text-xs text-fg placeholder:text-fg-muted"
                />
              </div>
            )}

            <div className={cn(area(POOL), "flex min-h-14 flex-wrap items-center gap-2")} {...dropProps(POOL)}>
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Not placed {board.pool.length}</span>
              {board.pool.map((row) => chip(row))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
              {board.lineups.map((lineup) => (
                <div key={lineup.id} className={cn(area(lineup.id), "space-y-2")} {...dropProps(lineup.id)}>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {archived ? (
                      <p className="flex-1 text-sm font-semibold text-fg">{lineup.name}</p>
                    ) : (
                      <SavingInput
                        value={lineup.name}
                        onSave={(name) => { if (name) run({ type: "updateLineup", lineupId: lineup.id, name }) }}
                        aria-label="Name of the lineup"
                        maxLength={60}
                        className="h-6 flex-1 px-1 text-sm font-semibold text-fg hover:border-line"
                      />
                    )}
                    <span className="text-xs text-fg-subtle">{lineup.players.length}</span>
                    {!archived && (
                      <button
                        type="button"
                        onClick={() => { if (lineup.players.length === 0 || confirm(`Remove the lineup “${lineup.name}”? Its players go back to “Not placed”.`)) run({ type: "deleteLineup", lineupId: lineup.id }) }}
                        aria-label={`Remove ${lineup.name}`}
                        className="p-0.5 text-fg-subtle hover:text-danger"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="flex min-h-24 flex-wrap content-start gap-2">{lineup.players.map((p) => chip(p, p.out))}</div>
                </div>
              ))}
              {!archived && (
                <AddLineup onAdd={(name) => run({ type: "addLineup", variantId: variant.id, name })} />
              )}
            </div>

            {archived ? (
              variant.note && <p className="whitespace-pre-wrap text-xs text-fg-muted">{variant.note}</p>
            ) : (
              <SavingInput
                value={variant.note ?? ""}
                onSave={(note) => run({ type: "updateVariant", variantId: variant.id, note: note || null })}
                onFocus={() => setTyping(`variant:${variant.id}`)}
                onLeave={() => setTyping(null)}
                placeholder="Notes on the variant"
                maxLength={1000}
                className="h-8 w-full border-dashed border-line px-2 text-xs text-fg-soft placeholder:text-fg-subtle"
              />
            )}
          </section>
        )
      })}

      {newVariant}
    </div>
  )
}

function AddLineup({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("")
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) { onAdd(name.trim()); setName("") }
      }}
      className="flex items-center gap-1 self-start rounded-lg border border-dashed border-line px-3 py-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="+ Lineup"
        maxLength={60}
        aria-label="New lineup"
        className="h-6 min-w-0 flex-1 bg-transparent px-1 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
      />
      {name.trim() && (
        <button type="submit" className="rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-brand-fg">
          <Plus size={12} />
        </button>
      )}
    </form>
  )
}
