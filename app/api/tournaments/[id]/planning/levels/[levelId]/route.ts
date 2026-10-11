import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"
import { bumpPlanning, loadPlanning } from "@/lib/planning-db"

interface Params {
  params: Promise<{ id: string; levelId: string }>
}

// Remove an extra level; players who chose it are open again
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, levelId } = await params
  const loaded = await loadPlanning(id)
  if (!loaded) return NextResponse.json({ error: "Für diese Comp läuft keine Planung" }, { status: 404 })
  if (loaded.archived) return NextResponse.json({ error: "Die Planung ist abgeschlossen." }, { status: 409 })

  await db.planningLevel.deleteMany({ where: { id: levelId, planningId: loaded.planning.id } })
  await bumpPlanning(loaded.planning.id)
  return new NextResponse(null, { status: 204 })
}
