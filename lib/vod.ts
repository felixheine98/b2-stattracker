// VOD links of a match: recordings of the stream, mostly on Twitch

export type VodSource = "twitch" | "youtube" | "video"

export interface Vod {
  url: string
  source: VodSource
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
