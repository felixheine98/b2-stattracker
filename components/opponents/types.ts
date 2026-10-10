import type { OpponentStatsMatch } from "@/lib/opponents"
export interface OpponentPlayer { id: string; name: string; tmId: string; country: string | null; isOpponentOnly: boolean; opponentNames?: string[] }
export interface RosterSlot { id: string; player: OpponentPlayer }
export interface TeamData {
  id: string; name: string; aliases: string[]; logo: string | null; archived: boolean; slots: RosterSlot[]
  source?: { blocks?: Array<{ key: string; name: string }>; checkedAt?: string } | null
}
export interface LineupData {
  id: string; name: string; aliases: string[]; logo: string | null; archived: boolean; slots: RosterSlot[]
  teamId: string | null; tournamentId: string; previousId?: string | null; notes?: string | null
  team?: { id: string; name: string; logo: string | null } | null
  tournament: { id: string; name: string }; _count?: { matches: number }
}
export interface OpponentChoices { teams: TeamData[]; lineups: LineupData[]; tournaments: Array<{ id: string; name: string }>; players?: OpponentPlayer[] }
export interface HistoryMatch extends OpponentStatsMatch {
  opponent: string | null; opponentLineupId: string | null; date: Date | string | null; slug?: string | null
  tournament: { id: string; name: string; slug?: string | null }; tournamentLineup: { id: string; name: string; slug?: string | null } | null
}
