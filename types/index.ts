import type { Format, Role } from "@prisma/client"

export type { Format, Role }

export interface PlayerWithStats {
  id: string
  tmId: string
  name: string
  createdAt: Date
  user?: { id: string; name: string; email: string } | null
  _count?: { roundResults: number }
}

export interface TournamentWithCounts {
  id: string
  name: string
  format: Format
  description?: string | null
  startDate?: Date | null
  endDate?: Date | null
  createdAt: Date
  _count: { matches: number }
}

export interface MatchWithDetails {
  id: string
  tournamentId: string
  opponent?: string | null
  date?: Date | null
  notes?: string | null
  createdAt: Date
  lineup?: {
    id: string
    slots: Array<{
      id: string
      player: { id: string; tmId: string; name: string }
    }>
  } | null
  _count: { rounds: number }
}

export interface RoundWithResults {
  id: string
  number: number
  track?: string | null
  timestamp?: Date | null
  results: Array<{
    id: string
    tmId: string
    playerName: string
    timeMs: number
    isOurTeam: boolean
    playerId?: string | null
    player?: { id: string; name: string } | null
  }>
}
