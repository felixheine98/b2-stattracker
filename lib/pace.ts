// Pace: how far a player is behind the fastest time of a round, averaged over the rounds
// driven. The fastest time is taken over both teams; rounds a player did not finish or has
// no time for are left out. In percent it compares across maps of different length, in
// milliseconds it only says something within one map.

export interface TimedResult {
  timeMs?: number | null
  dnf?: boolean | null
}

export interface PaceSum {
  // Rounds with a time
  rounds: number
  pctSum: number
  msSum: number
}

export const emptyPace = (): PaceSum => ({ rounds: 0, pctSum: 0, msSum: 0 })

// Time of a result that counts; null for a DNF or a result without time
export function finishTime(result: TimedResult): number | null {
  return result.dnf || result.timeMs == null ? null : result.timeMs
}

// The fastest time of a round; null when nobody has one
export function roundBest(results: TimedResult[]): number | null {
  const times = results.map(finishTime).filter((t): t is number => t !== null)
  return times.length > 0 ? Math.min(...times) : null
}

export function addGap(sum: PaceSum, timeMs: number, best: number): void {
  sum.rounds++
  sum.msSum += timeMs - best
  if (best > 0) sum.pctSum += ((timeMs - best) / best) * 100
}

export function pacePct(sum: PaceSum): number | null {
  return sum.rounds > 0 ? sum.pctSum / sum.rounds : null
}

export function paceMs(sum: PaceSum): number | null {
  return sum.rounds > 0 ? sum.msSum / sum.rounds : null
}

// "+1.9 %"
export function formatPacePct(pct: number | null): string {
  return pct === null ? "—" : `+${pct.toFixed(2)} %`
}

// "+1.234 s"
export function formatGapSeconds(ms: number | null): string {
  return ms === null ? "—" : `+${(ms / 1000).toFixed(3)} s`
}
