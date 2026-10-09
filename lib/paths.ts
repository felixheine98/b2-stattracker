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
