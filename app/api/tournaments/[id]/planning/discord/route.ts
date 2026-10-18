import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { buildPlanningState } from "@/lib/planning-db"
import { fetchReactions, signReactionSnapshot, verifyReactionSnapshot } from "@/lib/discord-bot"
import { reactionPreview, validateReactionMapping } from "@/lib/discord-planning"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

const answer = z.union([z.literal(""), z.enum(["FIX", "MAYBE", "OUT"]), z.string().regex(/^level:.+$/).transform(value => value as `level:${string}`)])
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fetch"), messageUrl: z.string().max(300) }),
  z.object({ action: z.literal("apply"), token: z.string().max(2_000_000),
    emojiMapping: z.record(z.string().max(200), answer), identities: z.record(z.string().max(30), z.string().max(100)),
    resolutions: z.record(z.string().max(100), answer),
  }),
])

class ImportError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as { id?: string; role?: string }
  if (!user.id || !canManage(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid import request." }, { status: 400 })
  const { id } = await params
  try {
    const state = await buildPlanningState(id, { userId: user.id, canManage: true, playerId: null })
    if (!state) throw new ImportError("There is no planning for this competition.", 404)
    if (state.archived) throw new ImportError("This planning is closed.", 409)
    const secret = process.env.AUTH_SECRET
    if (!secret) throw new ImportError("The import signing key is not configured.", 503)
    const input = parsed.data
    if (input.action === "fetch") {
      const snapshot = await fetchReactions(input.messageUrl)
      const linked = await db.player.findMany({ where: { discordUserId: { in: snapshot.users.map(u => u.id) } }, select: { id: true, discordUserId: true } })
      const onList = new Set(state.rows.map(r => r.player.id))
      return NextResponse.json({ snapshot, revision: state.revision, token: signReactionSnapshot({ snapshot, tournamentId: id, revision: state.revision }, secret),
        identities: Object.fromEntries(linked.filter(p => onList.has(p.id)).map(p => [p.discordUserId!, p.id])),
      })
    }

    const signed = verifyReactionSnapshot(input.token, secret, id)
    if (signed.revision !== state.revision) throw new ImportError("The planning changed since this preview. Fetch the reactions again.", 409)
    validateReactionMapping(signed.snapshot, input.emojiMapping, input.identities, state.rows.map(r => r.player.id), state.levels.map(l => l.id))
    const preview = reactionPreview(signed.snapshot, input.emojiMapping, input.identities, state.rows.map(r => ({ playerId: r.player.id, answer: r.answer })), input.resolutions)
    if (preview.some(r => r.kind === "conflict")) throw new ImportError("Resolve or skip all conflicting answers first.")
    const changes = preview.filter(r => r.kind === "change" && r.after)
    await db.$transaction(async tx => {
      const planning = await tx.planning.findUniqueOrThrow({ where: { tournamentId: id }, select: { id: true } })
      // A second import or a changed answer invalidates the preview, rather than overwriting it.
      const updated = await tx.planning.updateMany({ where: { id: planning.id, revision: signed.revision, tournament: { tournamentLineups: { none: {} } } },
        data: { revision: { increment: 1 }, discordSettings: { messageUrl: signed.snapshot.messageUrl, emojiMapping: input.emojiMapping } },
      })
      if (!updated.count) throw new ImportError("The planning changed. Fetch the reactions again.", 409)
      for (const [discordUserId, playerId] of Object.entries(input.identities)) {
        if (!playerId) continue
        const saved = await tx.player.updateMany({ where: { id: playerId, OR: [{ discordUserId: null }, { discordUserId }] }, data: { discordUserId } })
        if (!saved.count) throw new ImportError("A player already has a different Discord account. Check the assignments.", 409)
      }
      for (const row of changes) {
        const value = row.after!
        const data = { status: value === "FIX" || value === "MAYBE" || value === "OUT" ? value : null, levelId: value.startsWith("level:") ? value.slice(6) : null }
        await tx.planningEntry.upsert({ where: { planningId_playerId: { planningId: planning.id, playerId: row.playerId } },
          create: { planningId: planning.id, playerId: row.playerId, ...data }, update: data,
        })
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json({ changed: changes.length })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (["P2002", "P2034"].includes(error.code)) return NextResponse.json({ error: "An account assignment or the planning changed. Check the assignments and fetch again." }, { status: 409 })
      console.error("Discord import:", error)
      return NextResponse.json({ error: "The import could not be saved." }, { status: 500 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discord import failed." }, { status: error instanceof ImportError ? error.status : 400 })
  }
}
