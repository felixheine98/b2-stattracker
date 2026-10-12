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

// Sorting by `cpm:<raceId>` ranks by the CPM of that one edition
export type TfhTotalMetric = "races" | "playTimeSeconds" | "checkpoints" | "finishes" | `cpm:${string}`

interface TfhResult {
  playerId: string
  raceId: string
  checkpoints: number | null
  playTimeSeconds: number | null
  finishes: number
  cpm: number | null
}

// What every B2 driver did over the given TFH editions together: editions driven, play time,
// checkpoints and finishes added up. The pace is not merged over editions, because their maps
// differ: every edition keeps its own CPM, with the driver's rank among the B2 drivers of that
// edition (drivers with the same CPM share a rank). A missing source value counts as nothing in
// the sums and marks them as incomplete. Drivers without a value for the sorted column are not
// ranked and come last.
export function rankTfhTotals(results: TfhResult[], metric: TfhTotalMetric, order: "best" | "worst" = "best") {
  const byPlayer = new Map<string, { playerId: string; checkpoints: number; playTimeSeconds: number; finishes: number; incomplete: boolean; editions: Record<string, { cpm: number | null; rank: number | null }> }>()
  for (const r of results) {
    const total = byPlayer.get(r.playerId) ?? { playerId: r.playerId, checkpoints: 0, playTimeSeconds: 0, finishes: 0, incomplete: false, editions: {} }
    total.checkpoints += r.checkpoints ?? 0
    total.playTimeSeconds += r.playTimeSeconds ?? 0
    total.finishes += r.finishes
    total.incomplete ||= r.checkpoints === null || r.playTimeSeconds === null
    // Someone who drove for two B2 teams in one edition is listed with the better of the two
    const known = total.editions[r.raceId]?.cpm ?? null
    total.editions[r.raceId] = { cpm: r.cpm === null ? known : Math.max(r.cpm, known ?? r.cpm), rank: null }
    byPlayer.set(r.playerId, total)
  }
  const totals = [...byPlayer.values()].map(total => ({ ...total, races: Object.keys(total.editions).length }))
  for (const raceId of new Set(results.map(r => r.raceId))) {
    const paces = totals.map(t => t.editions[raceId]?.cpm ?? null).filter((cpm): cpm is number => cpm !== null)
    for (const t of totals) {
      const edition = t.editions[raceId]
      if (edition && edition.cpm !== null) edition.rank = 1 + paces.filter(cpm => cpm > edition.cpm!).length
    }
  }
  const valueOf = (t: (typeof totals)[number]): number | null =>
    metric === "races" || metric === "playTimeSeconds" || metric === "checkpoints" || metric === "finishes" ? t[metric] : t.editions[metric.slice(4)]?.cpm ?? null
  const byId = (a: { playerId: string }, b: { playerId: string }) => a.playerId.localeCompare(b.playerId)
  const valued = totals.filter(t => valueOf(t) !== null).sort((a, b) => valueOf(b)! - valueOf(a)! || byId(a, b))
  const ranked = valued.map(t => ({ rank: 1 + valued.findIndex(other => valueOf(other) === valueOf(t)) as number | null, ...t }))
  const missing = totals.filter(t => valueOf(t) === null).sort(byId).map(t => ({ rank: null as number | null, ...t }))
  return [...(order === "worst" ? ranked.reverse() : ranked), ...missing]
}

// 24h races and 12h RPG races are different styles of driving, so their totals are kept apart
const KIND_ORDER = ["24h", "12h"]

export function splitTfhByKind<R extends { kind: string }>(results: R[]): Array<{ kind: string; results: R[] }> {
  const kinds = [...new Set(results.map(r => r.kind))].sort((a, b) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
  return kinds.map(kind => ({ kind, results: results.filter(r => r.kind === kind) }))
}
