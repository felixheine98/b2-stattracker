// The vod-worker (docs/adr/011-vod-archiv.md): takes the next VOD range from the queue, cuts it out of
// the Twitch VOD with yt-dlp (no re-encoding, up to 1080p) and uploads it to the team's YouTube
// channel. Runs with plain Node, which strips the types: imports name their .ts files.
import { spawn } from "node:child_process"
import { mkdir, readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { afterFailure, downloadFailure, pickClip, STUCK_AFTER_MS, type Failure, type QueueMode, type QueuedClip } from "../lib/vod-queue.ts"

const db = new PrismaClient()
const WORK_DIR = process.env.VOD_WORK_DIR ?? "/work"
const POLL_MS = 30_000
const mode: QueueMode = process.env.VOD_ARCHIVE === "auto" || process.env.VOD_ARCHIVE === "manual" ? process.env.VOD_ARCHIVE : "off"

class BackupError extends Error {
  failure: Failure
  constructor(failure: Failure) {
    super(failure.message)
    this.failure = failure
  }
}

const log = (...parts: unknown[]) => console.log(new Date().toISOString(), ...parts)

// Runs a program; its last lines of output on failure
function run(command: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    const keep = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-8000) }
    child.stdout.on("data", keep)
    child.stderr.on("data", keep)
    child.on("error", reject)
    child.on("close", (code) => resolve({ code: code ?? 1, output }))
  })
}

// The range of the VOD as a file in the work directory
async function download(clip: { id: string; url: string; start: number; end: number }): Promise<string> {
  const vod = new URL(clip.url)
  vod.search = ""
  const { code, output } = await run("yt-dlp", [
    "--no-progress", "--no-playlist",
    "-f", "b[height<=1080]/bv*[height<=1080]+ba/b",
    "--download-sections", `*${clip.start}-${clip.end}`,
    "--merge-output-format", "mp4",
    "-o", join(WORK_DIR, `${clip.id}.%(ext)s`),
    vod.href,
  ])
  if (code !== 0) {
    const error = output.split("\n").reverse().find((line) => line.startsWith("ERROR:")) ?? output.trim().split("\n").at(-1) ?? "yt-dlp failed"
    throw new BackupError(downloadFailure(error))
  }
  const file = (await readdir(WORK_DIR)).find((name) => name.startsWith(`${clip.id}.`) && !name.endsWith(".part"))
  if (!file) throw new BackupError({ kind: "transient", message: "yt-dlp finished without a file." })
  return join(WORK_DIR, file)
}

// The upload to YouTube comes with "YouTube verbinden" (step c of ADR 011)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function upload(file: string): Promise<string> {
  throw new BackupError({ kind: "setup", message: "YouTube is not connected." })
}

async function backUp(clip: QueuedClip & { url: string; start: number; end: number }) {
  log("backing up", clip.id, clip.url, `${clip.start}-${clip.end}`)
  try {
    const file = await download(clip)
    log("cut", clip.id, file)
    const youtubeId = await upload(file)
    await db.vodClip.update({ where: { id: clip.id }, data: { status: "DONE", youtubeId, replacesYoutubeId: null, error: null, nextAttemptAt: null, requestedAt: null } })
    log("done", clip.id, youtubeId)
  } catch (e) {
    const failure = e instanceof BackupError ? e.failure : { kind: "transient" as const, message: (e as Error).message }
    const update = afterFailure(clip, failure, new Date())
    await db.vodClip.update({ where: { id: clip.id }, data: { ...update, ...(update.status === "FAILED" && { requestedAt: null }) } })
    log("failed", clip.id, failure.kind, failure.message, "→", update.status, update.nextAttemptAt?.toISOString() ?? "")
  } finally {
    // Ranges of hours are gigabytes: nothing stays after the upload
    for (const name of await readdir(WORK_DIR)) if (name.startsWith(`${clip.id}.`)) await rm(join(WORK_DIR, name), { force: true })
  }
}

async function tick() {
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS)
  const candidates = await db.vodClip.findMany({
    where: { OR: [{ status: "WAITING" }, { status: "LOADING", startedAt: { lt: stuckBefore } }] },
    select: { id: true, url: true, start: true, end: true, status: true, attempts: true, nextAttemptAt: true, requestedAt: true, startedAt: true, updatedAt: true },
  })
  const clip = pickClip(candidates.map((c) => ({ ...c, status: c.status as QueuedClip["status"] })), { now: new Date(), mode })
  if (!clip) return false
  // Taken only if nobody changed it since it was read (a new range, say)
  const taken = await db.vodClip.updateMany({ where: { id: clip.id, updatedAt: clip.updatedAt }, data: { status: "LOADING", startedAt: new Date() } })
  if (taken.count === 0) return true
  await backUp(clip)
  return true
}

async function main() {
  await mkdir(WORK_DIR, { recursive: true })
  log(`vod-worker started, mode ${mode}`)
  // Switched off (VOD_ARCHIVE in .env): stays up without touching the queue, so compose keeps it running
  if (mode === "off") return setInterval(() => {}, 1 << 30)
  for (;;) {
    let busy = false
    try {
      busy = await tick()
    } catch (e) {
      log("error", (e as Error).message)
    }
    // Straight on to the next clip after a backup, otherwise wait
    if (!busy) await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

main()
