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
  if (answer === "MAYBE") return "bg-[#FBD00D]"
  if (answer === "OUT") return "bg-[#ED1F24]"
  if (answer === "OPEN") return "bg-[#5e5858]"
  return "bg-[#6b8fff]"
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
      className={cn("min-w-0 rounded-md border border-transparent bg-transparent focus:border-[#FBD00D] focus:outline-none", className)}
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
          <span className="text-sm text-[#c5bfbf]">How many lineups?</span>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Button key={n} size="sm" variant="outline" onClick={() => { setAsking(false); run({ type: "createVariant", lineupCount: n }) }} className="w-9 px-0">
              {n}
            </Button>
          ))}
          <button type="button" onClick={() => setAsking(false)} className="text-xs text-[#5e5858] hover:text-[#f5f0f0]">Cancel</button>
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
      {variants.length === 0 && <p className="text-sm text-[#9a9090]">No variant yet.</p>}
      {error && <p className="text-sm text-[#ED1F24]">{error}</p>}

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
            target === POOL ? "border-dashed border-[#3a3435]" : "border-[#2d2829] bg-[#1c1819]",
            dragOver === `${variant.id}:${target}` && "border-[#FBD00D] bg-[#FBD00D]/5",
            picked && !archived && "cursor-pointer hover:border-[#FBD00D]/60"
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
                "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-[#251f20] px-2.5 py-1.5 text-sm transition-colors",
                out ? "border-[#ED1F24]/60 text-[#ED1F24]" : "border-[#2d2829] text-[#f5f0f0]",
                isSelected && "ring-2 ring-[#FBD00D]",
                // Someone else has picked this player up
                holder && !isSelected && "ring-2 ring-[#6b8fff]",
                !archived && "cursor-grab active:cursor-grabbing"
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor(row.answer))} />
              <span className="truncate">{row.player.name}</span>
              {out && <AlertTriangle size={11} className="shrink-0" />}
              {holder && <span className="shrink-0 rounded bg-[#6b8fff] px-1 text-[10px] font-semibold text-[#0e0b0b]">{holder.name}</span>}
              {/* The note belongs to the player in this variant and stays wherever they are moved */}
              {row.note && <span className="max-w-[16ch] truncate text-[11px] text-[#9a9090]">{row.note}</span>}
            </button>
          )
        }

        return (
          <section key={variant.id} className={cn("space-y-4 rounded-xl border p-5", adopted ? "border-[#FBD00D]/60" : "border-[#2d2829]")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {archived ? (
                <h3 className="text-base font-semibold text-[#f5f0f0]">{variant.name}</h3>
              ) : (
                <SavingInput
                  value={variant.name}
                  onSave={(name) => { if (name) run({ type: "updateVariant", variantId: variant.id, name }) }}
                  aria-label="Name of the variant"
                  maxLength={60}
                  className="h-8 w-48 max-w-full px-1.5 text-base font-semibold text-[#f5f0f0] hover:border-[#2d2829]"
                />
              )}
              {adopted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FBD00D] px-2.5 py-0.5 text-xs font-bold text-[#1a1718]">
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
                  voted ? "border-[#FBD00D]/50 bg-[#FBD00D]/15 text-[#FBD00D]" : "border-[#3a3435] text-[#9a9090] hover:text-[#f5f0f0]"
                )}
              >
                <ThumbsUp size={11} />
                {variant.votes.length > 0 ? variant.votes.map((v) => v.name).join(", ") : "In favour"}
              </button>
              {others.map((p) => (
                <span key={p.userId} className="rounded-full border border-[#6b8fff]/40 bg-[#6b8fff]/15 px-2 py-0.5 text-[11px] text-[#6b8fff]">
                  {p.name}{typingHere.includes(p) ? " is typing…" : ""}
                </span>
              ))}
              {board.outCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-[#ED1F24]">
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
                  <button type="button" onClick={() => run({ type: "createVariant", copyFrom: variant.id })} title="Copy variant" className="p-1.5 text-[#5e5858] hover:text-[#f5f0f0]">
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (confirm(`Delete the variant “${variant.name}”?`)) run({ type: "deleteVariant", variantId: variant.id }) }}
                    title="Delete variant"
                    className="p-1.5 text-[#5e5858] hover:text-[#ED1F24]"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </div>

            {/* The tapped player: where to put them, and the note on them in this variant */}
            {picked && !archived && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-[#FBD00D]/10 px-2.5 py-1.5 text-xs text-[#FBD00D]">
                <span><strong>{picked.player.name}</strong> selected – tap where to put them</span>
                <SavingInput
                  key={picked.player.id}
                  value={variant.playerNotes[picked.player.id] ?? ""}
                  onSave={(note) => run({ type: "notePlayer", variantId: variant.id, playerId: picked.player.id, note: note || null })}
                  onFocus={() => setTyping(`player:${variant.id}:${picked.player.id}`)}
                  onLeave={() => setTyping(null)}
                  placeholder="Note on this player"
                  maxLength={300}
                  className="h-7 min-w-40 flex-1 border-dashed border-[#FBD00D]/40 px-2 text-xs text-[#f5f0f0] placeholder:text-[#9a9090]"
                />
              </div>
            )}

            <div className={cn(area(POOL), "flex min-h-14 flex-wrap items-center gap-2")} {...dropProps(POOL)}>
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[#5e5858]">Not placed {board.pool.length}</span>
              {board.pool.map((row) => chip(row))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {board.lineups.map((lineup) => (
                <div key={lineup.id} className={cn(area(lineup.id), "space-y-2")} {...dropProps(lineup.id)}>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {archived ? (
                      <p className="flex-1 text-sm font-semibold text-[#f5f0f0]">{lineup.name}</p>
                    ) : (
                      <SavingInput
                        value={lineup.name}
                        onSave={(name) => { if (name) run({ type: "updateLineup", lineupId: lineup.id, name }) }}
                        aria-label="Name of the lineup"
                        maxLength={60}
                        className="h-6 flex-1 px-1 text-sm font-semibold text-[#f5f0f0] hover:border-[#2d2829]"
                      />
                    )}
                    <span className="text-xs text-[#5e5858]">{lineup.players.length}</span>
                    {!archived && (
                      <button
                        type="button"
                        onClick={() => { if (lineup.players.length === 0 || confirm(`Remove the lineup “${lineup.name}”? Its players go back to “Not placed”.`)) run({ type: "deleteLineup", lineupId: lineup.id }) }}
                        aria-label={`Remove ${lineup.name}`}
                        className="p-0.5 text-[#5e5858] hover:text-[#ED1F24]"
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
              variant.note && <p className="whitespace-pre-wrap text-xs text-[#9a9090]">{variant.note}</p>
            ) : (
              <SavingInput
                value={variant.note ?? ""}
                onSave={(note) => run({ type: "updateVariant", variantId: variant.id, note: note || null })}
                onFocus={() => setTyping(`variant:${variant.id}`)}
                onLeave={() => setTyping(null)}
                placeholder="Notes on the variant"
                maxLength={1000}
                className="h-8 w-full border-dashed border-[#2d2829] px-2 text-xs text-[#c5bfbf] placeholder:text-[#5e5858]"
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
      className="flex items-center gap-1 self-start rounded-lg border border-dashed border-[#2d2829] px-3 py-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="+ Lineup"
        maxLength={60}
        aria-label="New lineup"
        className="h-6 min-w-0 flex-1 bg-transparent px-1 text-sm text-[#f5f0f0] placeholder:text-[#5e5858] focus:outline-none"
      />
      {name.trim() && (
        <button type="submit" className="rounded-md bg-[#FBD00D] px-2 py-0.5 text-xs font-bold text-[#1a1718]">
          <Plus size={12} />
        </button>
      )}
    </form>
  )
}
