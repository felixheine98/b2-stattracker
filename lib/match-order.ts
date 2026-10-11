// The matches of a lineup are numbered through the tournament (#1, #2, ...) and listed in that
// order within their stage; a match can also carry a name such as "Upper Final". Both are optional.

interface Ordered {
  number?: number | null
  date?: Date | string | null
  createdAt: Date | string
}

const time = (value: Date | string) => new Date(value).getTime()

// By number; matches without one follow, by the day they are played and then by when they were added
export function sortMatches<T extends Ordered>(matches: T[]): T[] {
  return [...matches].sort(
    (a, b) =>
      (a.number ?? Infinity) - (b.number ?? Infinity) ||
      (a.number == null ? (a.date ? time(a.date) : Infinity) - (b.date ? time(b.date) : Infinity) : 0) ||
      time(a.createdAt) - time(b.createdAt)
  )
}

// The number of a new match next to the given ones, the matches a lineup already has in the
// tournament: it counts on from the highest number. Matches without a number count as well,
// so the numbering continues behind older matches that were never numbered.
export function nextMatchNumber(matches: Array<{ number?: number | null }>): number {
  return Math.max(matches.length, ...matches.map((m) => m.number ?? 0)) + 1
}

// "#2 · Upper Final", "#2", "Upper Final" or nothing
export function matchTag(match: { number?: number | null; label?: string | null }): string {
  return [match.number != null ? `#${match.number}` : null, match.label?.trim() || null].filter(Boolean).join(" · ")
}
