import { auth } from "@/lib/auth"
import { readSheetLogo } from "@/lib/opponent-source"
import { NextResponse } from "next/server"

// Preview the same bytes that will be copied on import, without external browser requests.
export async function GET(request: Request) {
  if (!await auth()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(request.url).searchParams.get("url")
  if (!url) return NextResponse.json({ error: "The logo source is missing." }, { status: 400 })
  try {
    const image = await readSheetLogo(url)
    return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": image.type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 })
  }
}
