import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { MAX_PASSKEYS, passkeyRegistrationOptions } from "@/lib/passkey-db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

const schema = z.object({ password: z.string().min(1) })

// Start adding a passkey to the signed-in account. A passkey signs in on its own, so the
// password has to be given, as for changing the password.
export async function POST(req: Request) {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "The password is missing" }, { status: 400 })

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, username: true, name: true, password: true, _count: { select: { passkeys: true } } },
  })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await bcrypt.compare(parsed.data.password, user.password))) {
    return NextResponse.json({ error: "The password is not correct" }, { status: 400 })
  }
  if (user._count.passkeys >= MAX_PASSKEYS) {
    return NextResponse.json({ error: `An account can have up to ${MAX_PASSKEYS} passkeys` }, { status: 400 })
  }

  return NextResponse.json(await passkeyRegistrationOptions(user))
}
