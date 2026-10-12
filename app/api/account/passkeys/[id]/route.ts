import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

interface Params {
  params: Promise<{ id: string }>
}

// Remove one of the own passkeys; it no longer signs in afterwards
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const removed = await db.passkey.deleteMany({ where: { id, userId } })
  if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
