// The queue of VOD backups (docs/adr/011-vod-archiv.md): which clip the vod-worker takes next and
// what a failure means for it. Without imports, so the worker can load it with plain Node.

export type ClipStatus = "WAITING" | "LOADING" | "DONE" | "FAILED"

export interface QueuedClip {
  id: string
  status: ClipStatus
  attempts: number
  nextAttemptAt: Date | null
  // Set when an admin asks for the backup by hand (the only way in dev)
  requestedAt: Date | null
  startedAt: Date | null
  updatedAt: Date
}

// auto: every saved range is backed up; manual: only the ones asked for; off: none
export type QueueMode = "auto" | "manual" | "off"

// Loading a 6-hour range and uploading it stays well below this; longer means the worker stopped midway
export const STUCK_AFTER_MS = 3 * 3600_000

const due = (clip: QueuedClip, now: Date) =>
  clip.status === "WAITING" ? !clip.nextAttemptAt || clip.nextAttemptAt <= now
    : clip.status === "LOADING" && !!clip.startedAt && now.getTime() - clip.startedAt.getTime() > STUCK_AFTER_MS

export function pickClip<T extends QueuedClip>(clips: T[], { now, mode }: { now: Date; mode: QueueMode }): T | null {
  if (mode === "off") return null
  const ready = clips.filter((c) => due(c, now) && (mode === "auto" || c.requestedAt))
  ready.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
  return ready[0] ?? null
}

// Why a backup did not work: passing (Twitch or YouTube not reachable, upload broken off), the VOD
// is gone or only for subscribers, YouTube's daily quota is used up, or YouTube is not connected
export type FailureKind = "transient" | "gone" | "subscribers" | "quota" | "setup"

export interface Failure {
  kind: FailureKind
  message: string
}

// Unrecognised download errors remain retryable; only explicit terminal errors stop the queue.
export function downloadFailure(output: string): Failure {
  const message = output.replace(/^\s*ERROR:\s*/i, "").trim()
  if (/only available for subscribers|subscriber-only/i.test(message)) return { kind: "subscribers", message }
  if (/\bVideo\s+\d+\s+does not exist\b|\bHTTP Error 404\b/i.test(message)) return { kind: "gone", message }
  return { kind: "transient", message }
}

export interface ClipUpdate {
  status: ClipStatus
  attempts: number
  nextAttemptAt: Date | null
  error: string
}

// Waits before the first, second and third retry
const RETRY_AFTER_MIN = [10, 60, 240]

const FINAL: Partial<Record<FailureKind, string>> = {
  gone: "The VOD is no longer available.",
  subscribers: "Only for subscribers – back it up yourself or ask the channel.",
}

// YouTube's daily quota starts anew at midnight Pacific time; a few minutes later to be safe
function quotaReset(now: Date): Date {
  const hourInPacific = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(d))
  const at = new Date(now)
  at.setUTCMinutes(0, 0, 0)
  do at.setTime(at.getTime() + 3600_000)
  while (hourInPacific(at) !== 0)
  return new Date(at.getTime() + 5 * 60_000)
}

export function afterFailure(clip: QueuedClip, failure: Failure, now: Date): ClipUpdate {
  if (failure.kind === "quota") return { status: "WAITING", attempts: clip.attempts, nextAttemptAt: quotaReset(now), error: "YouTube's daily upload limit is used up; it continues after it resets." }
  if (failure.kind === "setup") return { status: "WAITING", attempts: clip.attempts, nextAttemptAt: new Date(now.getTime() + 3600_000), error: failure.message }
  const attempts = clip.attempts + 1
  const final = FINAL[failure.kind]
  if (final) return { status: "FAILED", attempts, nextAttemptAt: null, error: final }
  const wait = RETRY_AFTER_MIN[attempts - 1]
  if (wait === undefined) return { status: "FAILED", attempts, nextAttemptAt: null, error: failure.message }
  return { status: "WAITING", attempts, nextAttemptAt: new Date(now.getTime() + wait * 60_000), error: failure.message }
}
