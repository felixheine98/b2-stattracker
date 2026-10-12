export function summarizeTfhProfile(results: Array<{ raceId: string; playTimeSeconds: number | null }>) {
  return {
    participations: new Set(results.map(r => r.raceId)).size,
    playTimeSeconds: results.reduce((sum, r) => sum + (r.playTimeSeconds ?? 0), 0),
    missingPlayTimes: results.filter(r => r.playTimeSeconds === null).length,
  }
}

export function formatTfhDuration(seconds: number | null): string {
  if (seconds === null) return "—"
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`
}

export function formatTfhElapsed(ms: number | null): string {
  if (ms === null) return "—"
  const seconds = Math.floor(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds % 3600 / 60))}:${pad(seconds % 60)}.${String(ms % 1000).padStart(3, "0")}`
}
