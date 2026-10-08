import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"
import { currentStatus } from "@/lib/player-status"
import { searchTmioPlayers, TmioError } from "@/lib/tmio"

// Search trackmania.io by name, account ID or player link
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const query = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  if (query.length < 3) return NextResponse.json({ error: "Enter at least 3 characters" }, { status: 400 })
  if (query.length > 200) return NextResponse.json({ error: "Search text is too long" }, { status: 400 })

  let found
  try {
    found = (await searchTmioPlayers(query)).slice(0, 20)
  } catch (e: unknown) {
    if (e instanceof TmioError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  // Mark players that already exist here so they are not added twice
  const existing = await db.player.findMany({
    where: { tmId: { in: found.map((p) => p.id), mode: "insensitive" } },
    include: { statusChanges: true },
  })
  const results = found.map((p) => {
    const known = existing.find((e) => e.tmId.toLowerCase() === p.id.toLowerCase())
    return { ...p, existing: known ? { name: known.name, status: currentStatus(known) } : null }
  })

  return NextResponse.json({ results })
}
