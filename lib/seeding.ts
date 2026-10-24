import { z } from "zod"

// Seeding formats (docs/adr/010-seeding-formate.md): each comp's seeding is scored its own way, so
// every format is a type introduced here. A comp chooses one and may change its numbers.

// A type rather than an interface, so it can be stored as JSON
export type SeedingSettings = {
  maps: number
  // Time slots per map; the slots are numbered over all maps in playing order
  slotsPerMap: number
  // Servers running at the same time, one run of ours on each
  servers: number
  rounds: number
  // How many of the best scores per map count
  best: number
  // Points per place in a round, for scores worked out from rounds
  points: number[]
  // A time per slot, e.g. "18:00"; empty where the slots have none
  times: string[]
}

export const SEEDING_TYPES = {
  // Rounds on two maps; the best 3 scores per map are summed up
  EMC: {
    label: "EMC",
    defaults: { maps: 2, slotsPerMap: 2, servers: 2, rounds: 10, best: 3, points: [10, 6, 4, 3, 2, 1], times: ["18:00", "18:30", "19:00", "19:30"] } as SeedingSettings,
  },
} as const

export type SeedingType = keyof typeof SEEDING_TYPES

export const isSeedingType = (value: unknown): value is SeedingType => typeof value === "string" && Object.hasOwn(SEEDING_TYPES, value)

const settingsSchema = z.object({
  maps: z.number().int().min(1).max(10),
  slotsPerMap: z.number().int().min(1).max(10),
  servers: z.number().int().min(1).max(10),
  rounds: z.number().int().min(1).max(100),
  best: z.number().int().min(1),
  points: z.array(z.number().int().min(0).max(1000)).max(200),
  times: z.array(z.string().trim().max(20)).max(100),
}).refine((s) => s.best <= s.slotsPerMap * s.servers, "More counted scores than runs on a map.")
  .refine((s) => s.times.length === 0 || s.times.length === s.maps * s.slotsPerMap, "Give a time for every slot, or none.")

// A comp's numbers over its type's; null without a known type. Throws on numbers that do not fit.
export function seedingSettings(type: string | null | undefined, raw: unknown): SeedingSettings | null {
  if (!isSeedingType(type)) return null
  const given = raw && typeof raw === "object" ? raw : {}
  return settingsSchema.parse({ ...SEEDING_TYPES[type].defaults, ...given })
}

// Every run of a lineup: per map its slots, per slot one run on each server
export function seedingRuns(settings: SeedingSettings): Array<{ map: number; slot: number; server: number }> {
  const runs = []
  for (let map = 0; map < settings.maps; map++)
    for (let s = 0; s < settings.slotsPerMap; s++)
      for (let server = 0; server < settings.servers; server++) runs.push({ map, slot: map * settings.slotsPerMap + s, server })
  return runs
}

export const slotLabel = (settings: SeedingSettings, slot: number) => settings.times[slot] || `Slot ${slot + 1}`

// A comp's seeding as a request sends it: a type with its numbers, or null for none
export const seedingInput = z.object({ type: z.string().max(40), settings: z.record(z.string(), z.unknown()) }).nullable()

export function readSeeding(input: z.infer<typeof seedingInput>): { seedingType: SeedingType | null; seedingSettings: SeedingSettings | null } | { error: string } {
  if (!input) return { seedingType: null, seedingSettings: null }
  if (!isSeedingType(input.type)) return { error: "Unknown seeding format." }
  const parsed = settingsSchema.safeParse({ ...SEEDING_TYPES[input.type].defaults, ...input.settings })
  if (!parsed.success) return { error: `Seeding: ${parsed.error.issues[0].message}` }
  return { seedingType: input.type, seedingSettings: parsed.data }
}

export const mapLabel = (map: number, names: string[] = []) => names[map] || `Map ${map + 1}`

export const runLabel = (settings: SeedingSettings, run: { map: number; slot: number; server: number }, mapNames: string[] = []) =>
  `${mapLabel(run.map, mapNames)} · ${slotLabel(settings, run.slot)} · Server ${run.server + 1}`

// What the comp dialog shows and sends: a type with all its numbers, or null for a seeding without format
export type SeedingChoice = { type: SeedingType; settings: SeedingSettings } | null

export function seedingChoiceOf(type: string | null | undefined, raw: unknown): SeedingChoice {
  if (!isSeedingType(type)) return null
  const given = raw && typeof raw === "object" ? raw : {}
  return { type, settings: { ...SEEDING_TYPES[type].defaults, ...given } }
}

// Who drives a map more than once, by the places of the runs in the order of seedingRuns
export function mapsDrivenTwice(settings: SeedingSettings, places: Array<string | null>): Array<{ playerId: string; map: number }> {
  const runs = seedingRuns(settings)
  const twice: Array<{ playerId: string; map: number }> = []
  for (let map = 0; map < settings.maps; map++) {
    const drivers = runs.flatMap((run, i) => (run.map === map && places[i] ? [places[i]] : []))
    for (const playerId of new Set(drivers.filter((id, i) => drivers.indexOf(id) !== i))) twice.push({ playerId, map })
  }
  return twice
}

// Puts a player on a run. Moved from another run (from), the player swaps places with the one there;
// otherwise it is one more run of theirs. Null where someone would then drive a map twice.
export function placeRun(settings: SeedingSettings, places: Array<string | null>, index: number, playerId: string | null, from?: number): Array<string | null> | null {
  const next = Array.from({ length: seedingRuns(settings).length }, (_, i) => places[i] ?? null)
  if (from !== undefined) next[from] = next[index]
  next[index] = playerId
  return mapsDrivenTwice(settings, next).length > 0 ? null : next
}

export interface RunResult {
  playerId: string | null
  score: number | null
}

// Puts the scores of each map (from the master sheet: who drove it and their score) on its runs:
// on the run the player drove or was planned for on that map, otherwise on a run not taken by
// another driver, in the order given. Runs nobody drove are left empty. Who does not fit is unplaced.
export function assignScores(
  settings: SeedingSettings,
  runs: Array<{ planned: string | null; recorded: string | null }>,
  scores: Array<Array<{ playerId: string; score: number }>>
): { runs: RunResult[]; unplaced: Array<{ map: number; playerId: string; score: number }> } {
  const layout = seedingRuns(settings)
  const result: RunResult[] = layout.map(() => ({ playerId: null, score: null }))
  const unplaced: Array<{ map: number; playerId: string; score: number }> = []
  for (let map = 0; map < settings.maps; map++) {
    const onMap = layout.flatMap((run, i) => (run.map === map ? [i] : []))
    const taken = new Set<number>()
    const rest: Array<{ playerId: string; score: number }> = []
    for (const driver of scores[map] ?? []) {
      const own = onMap.find((i) => !taken.has(i) && runs[i]?.recorded === driver.playerId)
        ?? onMap.find((i) => !taken.has(i) && runs[i]?.planned === driver.playerId)
      if (own === undefined) rest.push(driver)
      else { taken.add(own); result[own] = { playerId: driver.playerId, score: driver.score } }
    }
    for (const driver of rest) {
      const free = onMap.find((i) => !taken.has(i))
      if (free === undefined) unplaced.push({ map, ...driver })
      else { taken.add(free); result[free] = { playerId: driver.playerId, score: driver.score } }
    }
  }
  return { runs: result, unplaced }
}

// The best scores of each map (their runs, best first) and their sums; null without any score
export function seedingScore(settings: SeedingSettings, runs: RunResult[]): { maps: Array<{ sum: number; counted: number[] }>; total: number | null } {
  const layout = seedingRuns(settings)
  const maps = Array.from({ length: settings.maps }, (_, map) => {
    const counted = layout
      .flatMap((run, i) => (run.map === map && runs[i]?.score != null ? [i] : []))
      .sort((a, b) => runs[b].score! - runs[a].score! || a - b)
      .slice(0, settings.best)
    return { sum: counted.reduce((sum, i) => sum + runs[i].score!, 0), counted: counted.sort((a, b) => a - b) }
  })
  const any = runs.some((r) => r?.score != null)
  return { maps, total: any ? maps.reduce((sum, m) => sum + m.sum, 0) : null }
}
