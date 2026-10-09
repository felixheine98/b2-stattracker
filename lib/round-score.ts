// Points of a team round, the one place that decides who won it.
// With n players the winner gets n points, the next n-1 and so on down to 1;
// a player who did not finish gets none.

export interface ScoredResult {
  isOurTeam: boolean
  dnf?: boolean | null
}

export interface RoundScore {
  ours: number
  theirs: number
  outcome: "W" | "L" | "D"
}

// Placement of every result, given in finishing order. Players who did not finish have no
// order among themselves: all of them are on the last place.
export function roundPlacements(results: ScoredResult[]): number[] {
  let finished = 0
  return results.map((r) => (r.dnf ? results.length : ++finished))
}

// results must be in finishing order. Null while one of the teams has no result.
export function roundScore(results: ScoredResult[]): RoundScore | null {
  const n = results.length
  const placements = roundPlacements(results)
  let ours = 0, theirs = 0, ourCount = 0
  results.forEach((r, i) => {
    const points = r.dnf ? 0 : n - placements[i] + 1
    if (r.isOurTeam) { ours += points; ourCount++ }
    else theirs += points
  })
  if (ourCount === 0 || ourCount === n) return null
  return { ours, theirs, outcome: ours > theirs ? "W" : ours < theirs ? "L" : "D" }
}
