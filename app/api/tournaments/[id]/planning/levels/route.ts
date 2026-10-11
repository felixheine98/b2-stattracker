import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { bumpPlanning, loadPlanning } from "@/lib/planning-db"

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({ name: z.string().trim().min(1).max(30) })

// Add an extra availability level to this planning
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const loaded = await loadPlanning(id)
  if (!loaded) return NextResponse.json({ error: "Für diese Comp läuft keine Planung" }, { status: 404 })
  if (loaded.archived) return NextResponse.json({ error: "Die Planung ist abgeschlossen." }, { status: 409 })
  if (loaded.planning.levels.some((l) => l.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return NextResponse.json({ error: "Diese Stufe gibt es schon" }, { status: 409 })
  }

  const level = await db.planningLevel.create({ data: { planningId: loaded.planning.id, name: parsed.data.name } })
  await bumpPlanning(loaded.planning.id)
  return NextResponse.json(level, { status: 201 })
}
