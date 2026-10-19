import { auth } from "@/lib/auth"
import { canManage } from "@/lib/roles"
import { removeTrackedMessage } from "@/lib/discord-bot"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({ messageIds: z.array(z.string().regex(/^\d{1,20}$/)).min(1).max(1000) })

// The bot stops keeping reaction times for these messages; the messages on Discord stay as they are
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Send a list of message IDs." }, { status: 400 })
  try {
    for (const id of parsed.data.messageIds) await removeTrackedMessage(id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The bot could not remove the messages." }, { status: 502 })
  }
  return NextResponse.json({ removed: parsed.data.messageIds.length })
}
