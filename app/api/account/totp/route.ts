import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { totpRequiredForRole } from "@/lib/totp"
import { clearTotp } from "@/lib/totp-db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

// Whether the signed-in account uses two-factor sign-in
export async function GET() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({ where: { id }, select: { role: true, totpEnabledAt: true, totpRecoveryCodes: true } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({
    enabled: !!user.totpEnabledAt,
    required: totpRequiredForRole(user.role),
    recoveryCodesLeft: user.totpRecoveryCodes.length,
  })
}

const schema = z.object({ password: z.string().min(1) })

// Switch two-factor sign-in off; the password has to be given. An account that has to use it
// is asked to set it up again right away, which is how it moves to a new phone.
export async function DELETE(req: Request) {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "The password is missing" }, { status: 400 })

  const user = await db.user.findUnique({ where: { id }, select: { password: true } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await bcrypt.compare(parsed.data.password, user.password))) {
    return NextResponse.json({ error: "The password is not correct" }, { status: 400 })
  }

  await clearTotp(id)
  return new NextResponse(null, { status: 204 })
}
