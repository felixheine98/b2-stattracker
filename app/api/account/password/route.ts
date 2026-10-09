import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

const schema = z.object({
  current: z.string().min(1),
  password: z.string().min(8, "Das neue Passwort braucht mindestens 8 Zeichen").max(200),
})

// Change the password of the signed-in account; the current one has to be given
export async function PUT(req: Request) {
  const session = await auth()
  const id = (session?.user as { id?: string })?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const user = await db.user.findUnique({ where: { id }, select: { password: true } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await bcrypt.compare(parsed.data.current, user.password))) {
    return NextResponse.json({ error: "Das aktuelle Passwort stimmt nicht" }, { status: 400 })
  }

  await db.user.update({ where: { id }, data: { password: await bcrypt.hash(parsed.data.password, 12) } })
  return new NextResponse(null, { status: 204 })
}
