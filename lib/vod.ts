// VOD links of a match: recordings of the stream, mostly on Twitch

export type VodSource = "twitch" | "youtube" | "video"

export interface Vod {
  url: string
  source: VodSource
}

export interface VodLink {
  url: string
  label: string | null
}

// The VOD links as stored on a match (Match.vods); anything malformed is left out
export function vodLinks(raw: unknown): VodLink[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((v) => (v && typeof v.url === "string" ? [{ url: v.url, label: typeof v.label === "string" ? v.label : null }] : []))
}

const onHost = (hostname: string, domain: string) => hostname === domain || hostname.endsWith(`.${domain}`)

// A web link to a recording, with where it is hosted; null for anything that is not an http(s) link
export function readVod(input: string): Vod | null {
  const text = input.trim()
  if (!text) return null
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (!url.hostname.includes(".")) return null
  const host = url.hostname.toLowerCase()
  const source = onHost(host, "twitch.tv") ? "twitch" : onHost(host, "youtube.com") || onHost(host, "youtu.be") ? "youtube" : "video"
  return { url: url.href, source }
}

// Seconds from a Twitch timestamp such as "1h02m30s"
function seconds(text: string): number | null {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text)
  if (!m || !text) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

// Where a link starts the VOD (its ?t= timestamp), in seconds
export function vodStart(url: string): number | null {
  const t = readVod(url) && new URL(readVod(url)!.url).searchParams.get("t")
  return t ? seconds(t) : null
}

// The Twitch video behind a link to a VOD or highlight (twitch.tv/videos/<id>); null for clips,
// channels and other sites, which get no range
export function twitchVideoId(url: string): string | null {
  const vod = readVod(url)
  if (vod?.source !== "twitch") return null
  const { hostname, pathname } = new URL(vod.url)
  if (hostname.startsWith("clips.")) return null
  return /^\/videos\/(\d+)\/?$/.exec(pathname)?.[1] ?? null
}

// A point in a VOD as h:mm:ss, or m:ss below an hour
export function formatVodTime(at: number): string {
  const total = Math.floor(at), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export const MAX_RANGE = 6 * 3600

// Why a range (in seconds) cannot be saved, or null; the VOD's length where it is known
export function rangeError(start: number, end: number, length?: number): string | null {
  if (start < 0) return "The start lies before the VOD."
  if (end <= start) return "The start has to be before the end."
  if (length !== undefined && end > length) return "The range is longer than the VOD."
  if (end - start > MAX_RANGE) return "A range can be at most 6 hours long."
  return null
}
