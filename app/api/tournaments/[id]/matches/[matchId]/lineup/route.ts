import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Use /api/submatches/[id]/lineup instead" }, { status: 410 })
}

export async function PUT() {
  return NextResponse.json({ error: "Use /api/submatches/[id]/lineup instead" }, { status: 410 })
}
