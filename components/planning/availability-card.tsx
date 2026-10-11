"use client"

import { Card, CardContent } from "@/components/ui/card"
import { tournamentPath } from "@/lib/paths"
import type { Answer } from "@/lib/planning"
import Link from "next/link"
import { useState } from "react"
import { AvailabilityInput, type LevelRef } from "./availability-input"

interface Props {
  tournament: { id: string; slug?: string | null; name: string }
  playerId: string
  answer: Answer
  note: string | null
  levels: LevelRef[]
}

// Asks the signed-in player whether they take part in a tournament that is being planned
export function AvailabilityCard({ tournament, playerId, answer, note, levels }: Props) {
  // Follows the input below without reloading the page
  const [current, setCurrent] = useState(answer)

  return (
    <Card className={current === "OPEN" ? "border-[#FBD00D]/50" : ""}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-base font-semibold text-[#f5f0f0]">
            {current === "OPEN" ? `Bist du bei ${tournament.name} dabei?` : `Deine Antwort für ${tournament.name}`}
          </p>
          <Link href={`${tournamentPath(tournament)}/planung`} className="text-xs text-[#FBD00D] hover:underline">
            Alle ansehen
          </Link>
        </div>
        <AvailabilityInput
          tournamentId={tournament.id}
          playerId={playerId}
          answer={answer}
          note={note}
          levels={levels}
          editable
          onSaved={(change) => { if (change.answer) setCurrent(change.answer) }}
        />
      </CardContent>
    </Card>
  )
}
