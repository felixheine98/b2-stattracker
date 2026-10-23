// Addresses of the tournament pages, built from the readable slugs (the ID until a slug exists)
interface Addressable {
  id: string
  slug?: string | null
}

const part = (item: Addressable) => item.slug ?? item.id

export function tournamentPath(tournament: Addressable): string {
  return `/tournaments/${part(tournament)}`
}

export function lineupPath(tournament: Addressable, lineup: Addressable): string {
  return `${tournamentPath(tournament)}/${part(lineup)}`
}

export function matchPath(tournament: Addressable, lineup: Addressable, match: Addressable): string {
  return `${lineupPath(tournament, lineup)}/${part(match)}`
}

// A player's profile page
export function playerPath(player: Addressable): string {
  return `/players/${part(player)}`
}

// The lineup planning of a lineup for one stage (docs/adr/008)
export function planPath(tournament: Addressable, lineup: Addressable, stage: { id: string }): string {
  return `${lineupPath(tournament, lineup)}/plan/${stage.id}`
}
