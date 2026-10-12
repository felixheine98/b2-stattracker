import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { canManage } from "@/lib/roles"
import { clearTotp } from "@/lib/totp-db"

interface Params {
  params: Promise<{ id: string }>
}

// Switch two-factor sign-in off for an account, for someone who lost the phone and the recovery
// codes. The same rule as for passwords: admins for anyone, managers only for PLAYER accounts.
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  const sessionRole = session?.user?.role
  if (!canManage(sessionRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const target = await db.user.findUnique({ where: { id }, select: { role: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (sessionRole !== "ADMIN" && target.role !== "PLAYER") {
    return NextResponse.json({ error: "Only an admin can reset two-factor sign-in of manager or admin accounts" }, { status: 403 })
  }

  await clearTotp(id)
  return new NextResponse(null, { status: 204 })
}
