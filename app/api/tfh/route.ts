import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { previewTfhImport, saveTfhImport } from "@/lib/tfh-db"
import { syncPlayerSlugs, syncTournamentSlugs } from "@/lib/slugs-db"
import { tournamentPath } from "@/lib/paths"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const previewSchema = z.object({ url: z.string().max(500), selectedTeamIds: z.array(z.number().int().nonnegative()).min(1).max(200).optional() })

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "ADMIN") return NextResponse.json({ error: "Only admins can import TFH races." }, { status: 403 })
  try {
    const body = await request.json()
    if (body.action === "preview") return NextResponse.json(await previewTfhImport(previewSchema.parse(body), session.user.id))
    if (body.action !== "save") return NextResponse.json({ error: "Unknown import action." }, { status: 400 })
    const result = await saveTfhImport(body, session.user.id)
    await syncTournamentSlugs(result.tournamentId)
    await syncPlayerSlugs()
    const tournament = await db.tournament.findUniqueOrThrow({ where: { id: result.tournamentId }, select: { id: true, slug: true } })
    revalidatePath("/tournaments", "layout")
    revalidatePath("/players", "layout")
    return NextResponse.json({ path: tournamentPath(tournament) })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "The import data is incomplete or invalid. Check the preview and driver assignments." }, { status: 400 })
    const code = (error as { code?: string })?.code
    if (code === "P2002" || code === "P2034") return NextResponse.json({ error: "The race or player data has changed. Reload the preview." }, { status: 409 })
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error && !code ? error.message : "The import could not be saved. Reload the preview and try again." }, { status: 400 })
  }
}
