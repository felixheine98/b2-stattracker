import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Use /api/submatches/[id]/import instead" }, { status: 410 })
}
