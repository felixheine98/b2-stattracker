"use client"

import { Card, CardContent } from "@/components/ui/card"
import { tournamentPath } from "@/lib/paths"
import type { Answer } from "@/lib/planning"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronRight, CircleCheck, CircleDot, CircleHelp, CircleX, Pencil } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { AvailabilityInput, answerLabel, type LevelRef } from "./availability-input"

interface Props {
  tournament: { id: string; slug?: string | null; name: string }
  playerId: string
  answer: Answer
  // The player does not drive competitions as a rule and is not asked to answer
  inactive?: boolean
  note: string | null
  levels: LevelRef[]
}

// Asks the signed-in player whether they take part in a tournament that is being planned.
// While the answer is open it is a card that stands out; once answered it shrinks to a slim
// bar that says the answer in its colour and opens again to change it.
export function AvailabilityCard({ tournament, playerId, answer, inactive, note, levels }: Props) {
  // Follow the input without reloading the page
  const [current, setCurrent] = useState(answer)
  const [currentNote, setCurrentNote] = useState(note)
  // Whoever answers right now keeps the card, to add a note; it is collapsed from the next visit on
  const [open, setOpen] = useState(answer === "OPEN")
  const planning = `${tournamentPath(tournament)}/planning`

  if (!open && current !== "OPEN") {
    // A slim bar in the colour of the answer: a stripe on the left, the answer spelled out
    const tone =
      current === "FIX" ? { stripe: "bg-green-500", icon: "text-ok", Icon: CircleCheck, text: "You're available" }
      : current === "MAYBE" ? { stripe: "bg-info", icon: "text-info", Icon: CircleHelp, text: "You're a maybe" }
      : current === "OUT" ? { stripe: "bg-danger", icon: "text-danger", Icon: CircleX, text: "You're not available" }
      : current === "INACTIVE" ? { stripe: "bg-violet", icon: "text-violet", Icon: CircleDot, text: "You're set as inactive – answer if you want to play" }
      : { stripe: "bg-bronze", icon: "text-bronze", Icon: CircleDot, text: `Your answer: ${answerLabel(current, levels)}` }
    return (
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-xl border border-line bg-surface py-2.5 pl-5 pr-3">
        <span className={cn("absolute inset-y-0 left-0 w-1.5", tone.stripe)} />
        <tone.Icon size={18} className={cn("shrink-0", tone.icon)} />
        <p className="min-w-0 flex-1 basis-48 text-sm">
          <span className="text-base font-semibold text-fg">{tournament.name}</span>
          <span className="text-fg-muted"> · {tone.text}</span>
          {currentNote && <span className="block truncate text-xs text-fg-muted">“{currentNote}”</span>}
        </p>
        <span className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <Pencil size={13} />
            Change
          </Button>
          <Link href={planning} className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium text-brand-ink hover:bg-raised">
            Planning
            <ChevronRight size={14} />
          </Link>
        </span>
      </div>
    )
  }

  return (
    <Card className={current === "OPEN" ? "border-info/40 border-l-4 border-l-info" : ""}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-base font-semibold text-fg">
            {current === "OPEN" ? `Are you in for ${tournament.name}?` : `Your answer for ${tournament.name}`}
          </p>
          <span className="flex items-baseline gap-3 text-xs">
            <Link href={planning} className="text-brand-ink hover:underline">
              See everyone
            </Link>
            {current !== "OPEN" && (
              <button type="button" onClick={() => setOpen(false)} className="text-fg-muted hover:text-fg">
                Done
              </button>
            )}
          </span>
        </div>
        <AvailabilityInput
          tournamentId={tournament.id}
          playerId={playerId}
          answer={current}
          inactive={inactive}
          note={currentNote}
          levels={levels}
          editable
          onSaved={(change) => {
            if (change.answer) setCurrent(change.answer)
            if (change.note !== undefined) setCurrentNote(change.note)
          }}
        />
      </CardContent>
    </Card>
  )
}
