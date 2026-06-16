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
  const tournament = await db.tournament.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { date: "desc" },
        include: {
          lineup: { include: { slots: { include: { player: true } } } },
          _count: { select: { rounds: true } },
        },
      },
    },
  })

  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(tournament)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.tournament.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
