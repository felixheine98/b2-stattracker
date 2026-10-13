// How the list of tournaments is broken up for reading
import { dayKey, tournamentReferenceDate } from "./player-status"

// The tournaments under the year they start in (without a start date: were entered in), the
// latest year first; within a year they keep the order they were given in
export function groupByYear<T extends { startDate?: Date | string | null; createdAt: Date | string }>(tournaments: T[]): Array<{ year: number; tournaments: T[] }> {
  const years = new Map<number, T[]>()
  for (const tournament of tournaments) {
    const year = Number(dayKey(tournamentReferenceDate(tournament)).slice(0, 4))
    years.set(year, [...(years.get(year) ?? []), tournament])
  }
  return [...years.entries()].sort(([a], [b]) => b - a).map(([year, list]) => ({ year, tournaments: list }))
}
