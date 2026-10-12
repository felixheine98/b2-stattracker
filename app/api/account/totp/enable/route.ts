import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateRecoveryCodes, hashRecoveryCode, matchTotp } from "@/lib/totp"
import { openSecret } from "@/lib/totp-db"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({ code: z.string().min(1).max(20) })

// Finish the setup: a code from the app proves that it holds the secret. From then on the
// account needs a code at every sign-in. Answers with the recovery codes, which are shown once.
export async function POST(req: Request) {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "The code is missing" }, { status: 400 })

  const user = await db.user.findUnique({ where: { id }, select: { totpSecret: true, totpEnabledAt: true } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.totpEnabledAt) return NextResponse.json({ error: "Two-factor sign-in is already set up" }, { status: 409 })

  const secret = user.totpSecret ? openSecret(user.totpSecret) : null
  if (!secret) return NextResponse.json({ error: "Start the setup again" }, { status: 400 })

  const step = matchTotp(secret, parsed.data.code, Date.now())
  if (step == null) return NextResponse.json({ error: "The code is not correct. Check the time on your phone and try the next code." }, { status: 400 })

  const recoveryCodes = generateRecoveryCodes()
  await db.user.update({
    where: { id },
    data: {
      totpEnabledAt: new Date(),
      totpLastStep: step,
      totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
      totpFailures: 0,
      totpLockedUntil: null,
    },
  })
  return NextResponse.json({ recoveryCodes })
}
