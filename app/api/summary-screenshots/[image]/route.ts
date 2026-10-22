// The stats screenshots for the comparison page (docs/adr/007), read from the local Discord
// export. Dev only: they never reach production or the repository.
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { summaryCompareEnabled } from "@/lib/features"
import { canManage } from "@/lib/roles"

interface Params {
  params: Promise<{ image: string }>
}

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }

export async function GET(_req: Request, { params }: Params) {
  if (!summaryCompareEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const session = await auth()
  if (!canManage((session?.user as { role?: string } | undefined)?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // "<message id>_<image number>", as in the export's file names (date_messageid_n.ext)
  const { image } = await params
  if (!/^\d+_\d+$/.test(image)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const dir = path.join(process.env.SUMMARY_SCREENSHOTS_DIR!, "images")
  const file = (await readdir(dir)).find((name) => name.includes(`_${image}.`) && TYPES[path.extname(name).toLowerCase()])
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(await readFile(path.join(dir, file)), {
    headers: { "Content-Type": TYPES[path.extname(file).toLowerCase()], "Cache-Control": "private, max-age=3600" },
  })
}
