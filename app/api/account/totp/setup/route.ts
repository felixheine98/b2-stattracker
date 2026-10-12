import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateSecret, otpauthUri } from "@/lib/totp"
import { sealSecret } from "@/lib/totp-db"
import { NextResponse } from "next/server"
import QRCode from "qrcode"

// Start setting up two-factor sign-in: a new secret, as text and as a QR code for the
// authenticator app. It only counts once a code from the app has confirmed it (../enable).
export async function POST() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({ where: { id }, select: { username: true, totpEnabledAt: true } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.totpEnabledAt) return NextResponse.json({ error: "Two-factor sign-in is already set up" }, { status: 409 })

  const secret = generateSecret()
  await db.user.update({ where: { id }, data: { totpSecret: sealSecret(secret) } })

  const qr = await QRCode.toDataURL(otpauthUri(secret, user.username, "B2 Stats"), { margin: 2, width: 220 })
  return NextResponse.json({ secret, qr })
}
