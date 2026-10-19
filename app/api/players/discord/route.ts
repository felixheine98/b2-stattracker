import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

const discordUserId = z.string().regex(/^\d{1,20}$/)
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("link"), links: z.array(z.object({ discordUserId, playerId: z.string().max(100) })).min(1).max(500) }),
  z.object({ action: z.literal("unlink"), discordUserId }),
  z.object({ action: z.literal("not-a-player"), discordUserId, value: z.boolean() }),
])

async function manager() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

// Links are the only way an account and a player meet: one account per player, one player per account.
export async function POST(req: Request) {
  const denied = await manager()
  if (denied) return denied
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  const input = parsed.data

  if (input.action === "link") {
    const accounts = input.links.map(l => l.discordUserId), players = input.links.map(l => l.playerId)
    if (new Set(accounts).size !== accounts.length || new Set(players).size !== players.length) {
      return NextResponse.json({ error: "Each player and each Discord account can only be linked once." }, { status: 400 })
    }
    const found = await db.player.count({ where: { id: { in: players }, isOpponentOnly: false } })
    if (found !== players.length) return NextResponse.json({ error: "Player not found." }, { status: 404 })
    try {
      await db.$transaction(async tx => {
        // Clear first, so moving an account between players never trips the unique index.
        await tx.player.updateMany({ where: { OR: [{ discordUserId: { in: accounts } }, { id: { in: players } }] }, data: { discordUserId: null } })
        for (const link of input.links) await tx.player.update({ where: { id: link.playerId }, data: { discordUserId: link.discordUserId } })
        await tx.discordNonPlayer.deleteMany({ where: { discordUserId: { in: accounts } } })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        return NextResponse.json({ error: "The links changed meanwhile. Reload and try again." }, { status: 409 })
      }
      throw error
    }
    return NextResponse.json({ linked: input.links.length })
  }

  await db.$transaction(async tx => {
    if (input.action === "unlink" || input.value) await tx.player.updateMany({ where: { discordUserId: input.discordUserId }, data: { discordUserId: null } })
    if (input.action === "not-a-player") {
      if (input.value) await tx.discordNonPlayer.upsert({ where: { discordUserId: input.discordUserId }, create: { discordUserId: input.discordUserId }, update: {} })
      else await tx.discordNonPlayer.deleteMany({ where: { discordUserId: input.discordUserId } })
    }
  })
  return NextResponse.json({ ok: true })
}
