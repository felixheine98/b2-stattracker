import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"

function isAdmin(role?: string | null) {
  return role === "ADMIN"
}

interface Params {
  params: Promise<{ id: string }>
}

const patchSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "PLAYER"]).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!isAdmin((session?.user as { role?: string })?.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const user = await db.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, username: true, email: true, role: true, createdAt: true, player: { select: { id: true, name: true } } },
  })

  return NextResponse.json(user)
}

// Admins can delete any account but their own; managers only PLAYER accounts
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  const sessionRole = (session?.user as { role?: string })?.role
  if (!canManage(sessionRole))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  // Don't allow deleting yourself
  if ((session?.user as { id?: string })?.id === id)
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })

  const target = await db.user.findUnique({ where: { id }, select: { role: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!isAdmin(sessionRole) && target.role !== "PLAYER")
    return NextResponse.json({ error: "Only an admin can delete manager or admin accounts" }, { status: 403 })

  await db.user.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
