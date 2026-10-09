import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen").max(200),
})

// Set a new password for an account. Admins can do so for anyone, managers only for PLAYER
// accounts (the same accounts they can create and delete).
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  const sessionRole = (session?.user as { role?: string })?.role
  if (!canManage(sessionRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const target = await db.user.findUnique({ where: { id }, select: { role: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (sessionRole !== "ADMIN" && target.role !== "PLAYER") {
    return NextResponse.json({ error: "Only an admin can reset manager or admin passwords" }, { status: 403 })
  }

  await db.user.update({ where: { id }, data: { password: await bcrypt.hash(parsed.data.password, 12) } })
  return new NextResponse(null, { status: 204 })
}
