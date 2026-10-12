import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { addPasskey } from "@/lib/passkey-db"
import { NextResponse } from "next/server"
import { z } from "zod"

// The passkeys of the signed-in account
export async function GET() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const passkeys = await db.passkey.findMany({
    where: { userId: id },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(passkeys)
}

const schema = z.object({
  name: z.string().trim().min(1, "Give the passkey a name").max(60),
  // What the browser answered to the options from ./options
  response: z.object({ id: z.string(), response: z.object({}).loose() }).loose(),
})

// Finish adding a passkey
export async function POST(req: Request) {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const added = await addPasskey(id, parsed.data.response as never, parsed.data.name)
  if (!added) return NextResponse.json({ error: "The passkey could not be verified. Try again." }, { status: 400 })
  return new NextResponse(null, { status: 201 })
}
