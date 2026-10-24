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

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return bad("Unauthorized", 401)
  if (!canManage((session.user as { role?: string }).role)) return bad("Forbidden", 403)
  const { id, matchId } = await params
  const match = await db.match.findFirst({ where: { id: matchId, tournamentId: id }, select: { id: true, vods: true } })
  if (!match) return bad("Match not found", 404)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return bad(parsed.error.issues[0].message)
  const { url, start, end } = parsed.data
  if (!vodLinks(match.vods).some((v) => v.url === url)) return bad("This is not a VOD of the match.")
  if (!twitchVideoId(url)) return bad("A range can only be set on a Twitch VOD.")
  const error = rangeError(start, end)
  if (error) return bad(error)

  await db.vodClip.upsert({ where: { matchId_url: { matchId, url } }, create: { matchId, url, start, end }, update: { start, end } })
  return NextResponse.json({ ok: true })
}
