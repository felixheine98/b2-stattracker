import { parseTeamSheet, TEAM_SHEET_URL } from "./opponent-sheet"

async function readLimited(res: Response, limit: number): Promise<Uint8Array> {
  if (!res.ok || !res.body) throw new Error("Die externe Quelle ist momentan nicht erreichbar.")
  const reader = res.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw new Error("Die Datei ist zu groß.")
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return out
}
export async function readTeamSheet() {
  const response = await fetch(TEAM_SHEET_URL, { cache: "no-store", signal: AbortSignal.timeout(20_000) })
  return parseTeamSheet(new TextDecoder().decode(await readLimited(response, 8 * 1024 * 1024)))
}
export async function copySheetLogo(url: string | null): Promise<string | null> {
  if (!url) return null
  const source = new URL(url)
  if (source.protocol !== "https:" || !(source.hostname === "docs.google.com" && source.pathname.startsWith("/sheets-images-rt/"))) throw new Error("Unbekannte Logoquelle.")
  const res = await fetch(source, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) })
  const type = res.headers.get("content-type")?.split(";")[0]
  if (!type || !["image/png", "image/jpeg", "image/webp"].includes(type)) throw new Error("Die Logoquelle liefert kein unterstütztes Bild.")
  return `data:${type};base64,${Buffer.from(await readLimited(res, 1024 * 1024)).toString("base64")}`
}
