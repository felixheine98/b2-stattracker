// How the B2 drivers of one TFH race compare with each other, across all B2 teams of that race

export type TfhMetric = "cpm" | "checkpoints" | "playTimeSeconds" | "bestLapMs" | "averageLapMs" | "finishes"

// Lap times are better the lower they are; everything else the higher
const LOWER_IS_BETTER: TfhMetric[] = ["bestLapMs", "averageLapMs"]

interface DriverValues {
  sourceName: string
  cpm: number | null
  checkpoints: number | null
  playTimeSeconds: number | null
  bestLapMs: number | null
  averageLapMs: number | null
  finishes: unknown[]
}

interface RankedTeam {
  name: string
  isB2: boolean
  drivers: DriverValues[]
}

function valueOf(driver: DriverValues, metric: TfhMetric): number | null {
  return metric === "finishes" ? driver.finishes.length : driver[metric]
}

// Best first, or from the bottom up with order "worst". Drivers with the same value share a rank;
// drivers the source has no value for are not ranked and always come last, by name.
export function rankTfhDrivers<T extends RankedTeam>(teams: T[], metric: TfhMetric, order: "best" | "worst" = "best") {
  type Driver = T["drivers"][number]
  const rows = teams.filter(team => team.isB2).flatMap(team => team.drivers.map((driver: Driver) => ({ driver, team, value: valueOf(driver, metric) })))
  const byName = (a: { driver: Driver }, b: { driver: Driver }) => a.driver.sourceName.localeCompare(b.driver.sourceName)
  const sign = LOWER_IS_BETTER.includes(metric) ? 1 : -1
  const valued = rows.filter(row => row.value !== null).sort((a, b) => sign * (a.value! - b.value!) || byName(a, b))
  const ranked = valued.map(({ driver, team, value }) => ({ driver, team, rank: 1 + valued.findIndex(other => other.value === value) as number | null }))
  const missing = rows.filter(row => row.value === null).sort(byName).map(({ driver, team }) => ({ driver, team, rank: null as number | null }))
  return [...(order === "worst" ? ranked.reverse() : ranked), ...missing]
}

export type TfhTotalMetric = "races" | "playTimeSeconds" | "checkpoints"

interface TfhResult {
  playerId: string
  raceId: string
  checkpoints: number | null
  playTimeSeconds: number | null
}

// What every B2 driver did over all TFH editions together. Only values that add up are summed
// (editions driven, play time, checkpoints): pace and lap times depend on the map and are compared
// per race only. A missing source value counts as nothing and marks the total as incomplete.
export function rankTfhTotals(results: TfhResult[], metric: TfhTotalMetric, order: "best" | "worst" = "best") {
  const byPlayer = new Map<string, { playerId: string; raceIds: Set<string>; checkpoints: number; playTimeSeconds: number; incomplete: boolean }>()
  for (const r of results) {
    const total = byPlayer.get(r.playerId) ?? { playerId: r.playerId, raceIds: new Set<string>(), checkpoints: 0, playTimeSeconds: 0, incomplete: false }
    total.raceIds.add(r.raceId)
    total.checkpoints += r.checkpoints ?? 0
    total.playTimeSeconds += r.playTimeSeconds ?? 0
    total.incomplete ||= r.checkpoints === null || r.playTimeSeconds === null
    byPlayer.set(r.playerId, total)
  }
  const totals = [...byPlayer.values()]
    .map(({ raceIds, ...total }) => ({ ...total, races: raceIds.size }))
    .sort((a, b) => b[metric] - a[metric] || a.playerId.localeCompare(b.playerId))
  const ranked = totals.map(t => ({ rank: 1 + totals.findIndex(other => other[metric] === t[metric]), playerId: t.playerId, races: t.races, checkpoints: t.checkpoints, playTimeSeconds: t.playTimeSeconds, incomplete: t.incomplete }))
  return order === "worst" ? ranked.reverse() : ranked
}
