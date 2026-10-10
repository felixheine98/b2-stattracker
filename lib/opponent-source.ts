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
function checkedLogoUrl(value: string): URL {
  let source: URL
  try { source = new URL(value) } catch { throw new Error("Unbekannte Logoquelle.") }
  const googleSheet = source.hostname === "docs.google.com" && source.pathname.startsWith("/sheets-images-rt/")
  const googleImage = /^lh\d+(?:-rt)?\.googleusercontent\.com$/.test(source.hostname) && source.pathname.startsWith("/rd-sheets-images-rt/")
  if (source.protocol !== "https:" || source.username || source.password || source.port || !(googleSheet || googleImage)) throw new Error("Unbekannte Logoquelle.")
  return source
}
export async function readSheetLogo(url: string) {
  let source = checkedLogoUrl(url)
  const signal = AbortSignal.timeout(15_000)
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(source, { cache: "no-store", redirect: "manual", signal })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel()
      const location = response.headers.get("location")
      if (!location) throw new Error("Die Logoquelle liefert keine gültige Weiterleitung.")
      source = checkedLogoUrl(new URL(location, source).toString())
      continue
    }
    if (!response.ok) throw new Error(`Das Logo konnte nicht geladen werden (HTTP ${response.status}).`)
    const type = response.headers.get("content-type")?.split(";")[0].trim()
    if (!type || !["image/png", "image/jpeg", "image/webp"].includes(type)) throw new Error("Die Logoquelle liefert kein unterstütztes Bild.")
    return { type, bytes: await readLimited(response, 1024 * 1024) }
  }
  throw new Error("Die Logoquelle liefert zu viele Weiterleitungen.")
}
export async function copySheetLogo(url: string | null): Promise<string | null> {
  if (!url) return null
  const image = await readSheetLogo(url)
  return `data:${image.type};base64,${Buffer.from(image.bytes).toString("base64")}`
}
