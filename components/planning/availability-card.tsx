"use client"

import { Card, CardContent } from "@/components/ui/card"
import { tournamentPath } from "@/lib/paths"
import type { Answer } from "@/lib/planning"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useState } from "react"
import { AvailabilityInput, answerColor, answerLabel, type LevelRef } from "./availability-input"

interface Props {
  tournament: { id: string; slug?: string | null; name: string }
  playerId: string
  answer: Answer
  note: string | null
  levels: LevelRef[]
}

// Asks the signed-in player whether they take part in a tournament that is being planned.
// While the answer is open it is a card that stands out; once answered it shrinks to a single
// quiet line that shows the answer and opens again to change it.
export function AvailabilityCard({ tournament, playerId, answer, note, levels }: Props) {
  // Follow the input without reloading the page
  const [current, setCurrent] = useState(answer)
  const [currentNote, setCurrentNote] = useState(note)
  // Whoever answers right now keeps the card, to add a note; it is collapsed from the next visit on
  const [open, setOpen] = useState(answer === "OPEN")
  const planning = `${tournamentPath(tournament)}/planung`

  if (!open && current !== "OPEN") {
    return (
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 text-xs text-[#5e5858]">
        <span>Planung {tournament.name}:</span>
        <span className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", answerColor(current))}>
          {answerLabel(current, levels)}
        </span>
        {currentNote && <span className="min-w-0 max-w-full truncate text-[#9a9090]">{currentNote}</span>}
        <button type="button" onClick={() => setOpen(true)} className="text-[#9a9090] underline decoration-dotted underline-offset-2 hover:text-[#f5f0f0]">
          ändern
        </button>
        <Link href={planning} className="text-[#9a9090] underline decoration-dotted underline-offset-2 hover:text-[#f5f0f0]">
          alle ansehen
        </Link>
      </div>
    )
  }

  return (
    <Card className={current === "OPEN" ? "border-[#FBD00D]/50" : ""}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-base font-semibold text-[#f5f0f0]">
            {current === "OPEN" ? `Bist du bei ${tournament.name} dabei?` : `Deine Antwort für ${tournament.name}`}
          </p>
          <span className="flex items-baseline gap-3 text-xs">
            <Link href={planning} className="text-[#FBD00D] hover:underline">
              Alle ansehen
            </Link>
            {current !== "OPEN" && (
              <button type="button" onClick={() => setOpen(false)} className="text-[#9a9090] hover:text-[#f5f0f0]">
                Fertig
              </button>
            )}
          </span>
        </div>
        <AvailabilityInput
          tournamentId={tournament.id}
          playerId={playerId}
          answer={current}
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
