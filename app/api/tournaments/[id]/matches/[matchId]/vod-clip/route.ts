import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { rangeError, twitchVideoId, vodLinks } from "@/lib/vod"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

// The range of a match within one of its Twitch VODs (docs/adr/011-vod-archiv.md); set by admins
// and managers only, as it decides what goes onto the team's YouTube channel
const schema = z.object({ url: z.string().max(500), start: z.number().int(), end: z.number().int() })

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

// Admins and managers only; the match with its VOD links, or the response to send instead
async function access({ params }: Params) {
  const session = await auth()
  if (!session) return bad("Unauthorized", 401)
  if (!canManage((session.user as { role?: string }).role)) return bad("Forbidden", 403)
  const { id, matchId } = await params
  const match = await db.match.findFirst({ where: { id: matchId, tournamentId: id }, select: { id: true, vods: true } })
  return match ?? bad("Match not found", 404)
}

// A backup queued from scratch: waiting, with no attempts or error left over
const queued = { status: "WAITING", attempts: 0, nextAttemptAt: null, startedAt: null, error: null }

export async function PUT(req: Request, context: Params) {
  const match = await access(context)
  if (match instanceof Response) return match
  const matchId = match.id

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return bad(parsed.error.issues[0].message)
  const { url, start, end } = parsed.data
  if (!vodLinks(match.vods).some((v) => v.url === url)) return bad("This is not a VOD of the match.")
  if (!twitchVideoId(url)) return bad("A range can only be set on a Twitch VOD.")
  const error = rangeError(start, end)
  if (error) return bad(error)

  const existing = await db.vodClip.findUnique({ where: { matchId_url: { matchId, url } } })
  if (!existing) await db.vodClip.create({ data: { matchId, url, start, end } })
  // A changed range is backed up anew; its earlier backup stays shown until the new one replaces it
  else if (existing.start !== start || existing.end !== end) {
    await db.vodClip.update({ where: { id: existing.id }, data: { start, end, ...queued, requestedAt: null, replacesYoutubeId: existing.youtubeId ?? existing.replacesYoutubeId } })
  }
  return NextResponse.json({ ok: true })
}

// Asks for the backup of a range by hand: the only way in dev, and "try again" after a failure
export async function POST(req: Request, context: Params) {
  const match = await access(context)
  if (match instanceof Response) return match
  const parsed = z.object({ url: z.string().max(500) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return bad(parsed.error.issues[0].message)
  const clip = await db.vodClip.findUnique({ where: { matchId_url: { matchId: match.id, url: parsed.data.url } } })
  if (!clip) return bad("No range is set for this VOD.", 404)
  await db.vodClip.update({ where: { id: clip.id }, data: { ...queued, requestedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
