import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const player = await db.player.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      roundResults: {
        include: { round: { select: { number: true, track: true, match: { select: { tournament: { select: { name: true } } } } } } },
        orderBy: { round: { number: "asc" } },
      },
    },
  })

  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(player)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.player.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
