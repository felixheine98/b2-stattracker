import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { feedbackStatus } from "@/lib/feedback"
import { z } from "zod"

export async function PATCH(req: Request) {
  if (process.env.APP_FEEDBACK !== "on") return Response.json({ error: "Not found" }, { status: 404 })
  const session = await auth()
  if (session?.user?.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = z.object({ id: z.string().min(1).max(100), status: feedbackStatus }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid status" }, { status: 400 })
  const result = await db.appFeedback.updateMany({ where: { id: parsed.data.id }, data: { status: parsed.data.status } })
  return result.count ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 })
}
