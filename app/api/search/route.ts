import { auth } from "@/lib/auth"
import { searchIndex } from "@/lib/search-db"
import { NextResponse } from "next/server"

// The index the search dialog works on (see lib/search.ts)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await searchIndex())
}
