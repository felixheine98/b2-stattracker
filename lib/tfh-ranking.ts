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

export type TfhTotalMetric = "cpm" | "races" | "playTimeSeconds" | "checkpoints" | "finishes"

interface TfhResult {
  playerId: string
  raceId: string
  checkpoints: number | null
  playTimeSeconds: number | null
  finishes: number
}

// What every B2 driver did over the given TFH editions together: editions driven, play time,
// checkpoints and finishes added up. The pace (CPM) is all checkpoints by all minutes driven,
// taken from the races that supplied both; it mixes the maps of those races, which is why 24h
// and 12h races are compared apart (splitTfhByKind). A missing source value counts as nothing
// and marks the totals as incomplete. Drivers without a pace are not ranked by it and come last.
export function rankTfhTotals(results: TfhResult[], metric: TfhTotalMetric, order: "best" | "worst" = "best") {
  const byPlayer = new Map<string, { playerId: string; raceIds: Set<string>; checkpoints: number; playTimeSeconds: number; finishes: number; incomplete: boolean; pacedCheckpoints: number; pacedSeconds: number }>()
  for (const r of results) {
    const total = byPlayer.get(r.playerId) ?? { playerId: r.playerId, raceIds: new Set<string>(), checkpoints: 0, playTimeSeconds: 0, finishes: 0, incomplete: false, pacedCheckpoints: 0, pacedSeconds: 0 }
    total.raceIds.add(r.raceId)
    total.checkpoints += r.checkpoints ?? 0
    total.playTimeSeconds += r.playTimeSeconds ?? 0
    total.finishes += r.finishes
    total.incomplete ||= r.checkpoints === null || r.playTimeSeconds === null
    if (r.checkpoints !== null && r.playTimeSeconds !== null) {
      total.pacedCheckpoints += r.checkpoints
      total.pacedSeconds += r.playTimeSeconds
    }
    byPlayer.set(r.playerId, total)
  }
  const totals = [...byPlayer.values()].map(({ raceIds, pacedCheckpoints, pacedSeconds, ...total }) => ({
    ...total,
    races: raceIds.size,
    cpm: pacedSeconds > 0 ? pacedCheckpoints / (pacedSeconds / 60) : null,
  }))
  const byId = (a: { playerId: string }, b: { playerId: string }) => a.playerId.localeCompare(b.playerId)
  const valued = totals.filter(t => t[metric] !== null).sort((a, b) => b[metric]! - a[metric]! || byId(a, b))
  const ranked = valued.map(t => ({ rank: 1 + valued.findIndex(other => other[metric] === t[metric]) as number | null, ...t }))
  const missing = totals.filter(t => t[metric] === null).sort(byId).map(t => ({ rank: null as number | null, ...t }))
  return [...(order === "worst" ? ranked.reverse() : ranked), ...missing]
}

// 24h races and 12h RPG races are different styles of driving, so their totals are kept apart
const KIND_ORDER = ["24h", "12h"]

export function splitTfhByKind<R extends { kind: string }>(results: R[]): Array<{ kind: string; results: R[] }> {
  const kinds = [...new Set(results.map(r => r.kind))].sort((a, b) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
  return kinds.map(kind => ({ kind, results: results.filter(r => r.kind === kind) }))
}
