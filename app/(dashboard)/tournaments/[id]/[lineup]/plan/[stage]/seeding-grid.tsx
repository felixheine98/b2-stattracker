"use client"

import { useState } from "react"
import { AlertTriangle, GripVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { planPool, seatSuggestions, type MatchdayAnswer } from "@/lib/matchday-plan"
import { shownName } from "@/lib/player-names"
import { placeRun, seedingRuns, slotLabel, type SeedingSettings } from "@/lib/seeding"
import { cn } from "@/lib/utils"
import { SeatInput, type SeatPlayer } from "./seat-input"

interface Props {
  settings: SeedingSettings
  // The player of every run, in the order of seedingRuns
  places: Array<string | null>
  kader: SeatPlayer[]
  answers: Record<string, MatchdayAnswer | undefined>
  dot: (playerId: string) => string
  disabled: boolean
  onChange: (places: Array<string | null>) => void
}

// A player being moved: from the kader, or from a run (from) to swap with another
type Picked = { playerId: string; from?: number }

// The runs of a seeding (docs/adr/010): per map its times, per time one run on each server.
// Players are dragged from the kader or from another run, or typed in; on phones a tap on a
// player and then on a run does the same. Nobody can be put on a map twice.
export function SeedingGrid({ settings, places, kader, answers, dot, disabled, onChange }: Props) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [refused, setRefused] = useState("")
  const runs = seedingRuns(settings)
  const playerOf = (id: string) => kader.find((p) => p.id === id) ?? { id, name: "Unknown", country: null }
  const { top, below } = planPool(kader, answers)

  function put(index: number, playerId: string | null, from?: number) {
    setPicked(null)
    if (from === index) return
    const next = placeRun(settings, places, index, playerId, from)
    if (!next) {
      setRefused(`${shownName(playerOf(playerId!))} cannot drive map ${runs[index].map + 1} twice.`)
      return
    }
    setRefused("")
    onChange(next)
  }

  const drag = (item: Picked) => ({
    draggable: !disabled,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(item))
      e.dataTransfer.effectAllowed = "move"
    },
  })

  const drop = (index: number) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      try {
        const item = JSON.parse(e.dataTransfer.getData("text/plain")) as Picked
        put(index, item.playerId, item.from)
      } catch {
        // Something else was dropped
      }
    },
  })

  const chip = (player: SeatPlayer) => (
    <button
      key={player.id}
      type="button"
      {...drag({ playerId: player.id })}
      onClick={() => setPicked((p) => (p?.playerId === player.id && p.from === undefined ? null : { playerId: player.id }))}
      aria-pressed={picked?.playerId === player.id && picked.from === undefined}
      disabled={disabled}
      className={cn(
        "inline-flex cursor-grab items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm active:cursor-grabbing max-md:py-1.5",
        picked?.playerId === player.id && picked.from === undefined ? "border-brand bg-brand/15 text-fg" : "border-line bg-raised text-fg-soft hover:border-line-strong"
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot(player.id))} />
      {shownName(player)}
      <span className="text-xs text-fg-subtle">{places.filter((id) => id === player.id).length || ""}</span>
    </button>
  )

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-title mb-1">Runs</h2>
        <p className="text-xs text-fg-subtle">
          Drag players from the kader onto a run, or a run onto another to swap; on a phone tap a player, then a run. Each player drives a map at most once.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {top.map(chip)}
        {below.length > 0 && top.length > 0 && <span className="mx-1 self-center text-xs text-fg-subtle">·</span>}
        {below.map(chip)}
      </div>
      {picked && <p className="text-xs text-brand-ink">Tap a run to put {shownName(playerOf(picked.playerId))} there.</p>}
      {refused && (
        <p className="flex items-center gap-1.5 text-sm text-danger">
          <AlertTriangle size={14} className="shrink-0" />
          {refused}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: settings.maps }, (_, map) => (
          <Card key={map}>
            <CardContent className="space-y-3 pt-5">
              <h3 className="text-sm font-semibold text-fg">Map {map + 1}</h3>
              {Array.from({ length: settings.slotsPerMap }, (_, s) => {
                const slot = map * settings.slotsPerMap + s
                return (
                  <div key={slot} className="grid grid-cols-1 gap-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center">
                    <span className="text-sm text-fg-muted tabular-nums">{slotLabel(settings, slot)}</span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {runs.map((run, index) => {
                        if (run.slot !== slot) return null
                        const playerId = places[index] ?? null
                        // Others on this map are not offered while typing
                        const onMap = runs.flatMap((r, i) => (r.map === map && i !== index ? [places[i] ?? null] : []))
                        return (
                          <div
                            key={index}
                            {...drop(index)}
                            // A tapped player goes here instead of the field opening for typing
                            onClickCapture={(e) => {
                              if (!picked) return
                              e.preventDefault()
                              e.stopPropagation()
                              put(index, picked.playerId, picked.from)
                            }}
                            className={cn("flex items-center gap-1 rounded-lg", picked && "ring-1 ring-brand/40")}
                          >
                            <span
                              {...(playerId ? drag({ playerId, from: index }) : {})}
                              onClick={() => playerId && setPicked((p) => (p?.from === index ? null : { playerId, from: index }))}
                              title={playerId ? "Drag or tap to move" : undefined}
                              className={cn("shrink-0 text-fg-subtle", playerId ? "cursor-grab" : "invisible")}
                            >
                              <GripVertical size={14} />
                            </span>
                            <span className="w-6 shrink-0 text-xs text-fg-subtle">S{run.server + 1}</span>
                            <div className="min-w-0 flex-1">
                              <SeatInput
                                label={`Map ${map + 1}, ${slotLabel(settings, slot)}, server ${run.server + 1}`}
                                player={playerId ? playerOf(playerId) : null}
                                suggest={(query) => seatSuggestions(query, kader, answers, onMap)}
                                dot={dot}
                                warn={!!playerId && answers[playerId] === "OUT"}
                                disabled={disabled}
                                onPick={(id) => put(index, id)}
                                onClear={() => put(index, null)}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
