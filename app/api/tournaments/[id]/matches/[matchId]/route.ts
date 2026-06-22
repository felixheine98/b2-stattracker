import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string; matchId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      subMatches: {
        orderBy: { order: "asc" },
        include: {
          lineup: { include: { slots: { include: { player: true } } } },
          rounds: {
            orderBy: { number: "asc" },
            include: { results: { orderBy: { timeMs: "asc" } } },
          },
        },
      },
    },
  })

  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(match)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { matchId } = await params
  await db.match.delete({ where: { id: matchId } })
  return new NextResponse(null, { status: 204 })
}
