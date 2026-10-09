// Finding the match an eCircuitMania import belongs to, from the two team names on their page
import { slugify } from "./slugs"

interface Tournament {
  id: string
  tournamentLineups: Array<{
    id: string
    name: string
    matches: Array<{ id: string; opponent: string | null }>
  }>
}

export interface EcmTarget {
  tournamentId: string
  lineupId: string
  // The other team on the eCM page
  opponent: string
  // Existing matches of the lineup against that opponent; empty when it still has to be created
  matchIds: string[]
}

// tournaments must be ordered newest first. One of the two teams has to be a lineup of ours
// (names are compared without case, spaces and punctuation). A tournament in which the lineup
// already plays the opponent wins; otherwise the newest tournament the lineup is part of.
export function suggestEcmTarget(teams: string[], tournaments: Tournament[]): EcmTarget | null {
  let fallback: EcmTarget | null = null
  for (const tournament of tournaments) {
    for (const lineup of tournament.tournamentLineups) {
      const own = teams.find((t) => slugify(t) === slugify(lineup.name))
      const opponent = teams.find((t) => t !== own)
      if (!own || !opponent) continue
      const matchIds = lineup.matches.filter((m) => slugify(m.opponent ?? "") === slugify(opponent)).map((m) => m.id)
      const target = { tournamentId: tournament.id, lineupId: lineup.id, opponent, matchIds }
      if (matchIds.length > 0) return target
      fallback ??= target
    }
  }
  return fallback
}
