import { Video } from "lucide-react"
import { readVod, type VodSource } from "@/lib/vod"

export interface VodLink {
  url: string
  label: string | null
}

// The VOD links as stored on a match; anything malformed is left out
export function vodLinks(raw: unknown): VodLink[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((v) => (v && typeof v.url === "string" ? [{ url: v.url, label: typeof v.label === "string" ? v.label : null }] : []))
}

// Lucide has no brand icons any more: the Twitch glyph
function TwitchIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M4.3 2 3 5.4v13.8h4.7V22h2.6l2.8-2.8h3.8L22 14.1V2H4.3Zm15.9 11.2-2.9 2.9h-4.7L10 18.6v-2.5H6V3.8h14.2v9.4ZM17.3 7v5.1h-1.8V7h1.8Zm-4.7 0v5.1h-1.8V7h1.8Z" />
    </svg>
  )
}

function SourceIcon({ source, size }: { source: VodSource; size: number }) {
  if (source === "twitch") return <span className="text-[#9146ff]"><TwitchIcon size={size} /></span>
  if (source === "youtube") return <Video size={size} className="shrink-0 text-[#ff0033]" />
  return <Video size={size} className="shrink-0" />
}

const fallbackName = (source: VodSource) => (source === "twitch" ? "Twitch VOD" : source === "youtube" ? "YouTube" : "VOD")

export function VodLinks({ vods }: { vods: VodLink[] }) {
  if (vods.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {vods.map((v, i) => {
        const source = readVod(v.url)?.source ?? "video"
        return (
          <a
            key={i}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-soft hover:border-line-strong hover:text-fg"
          >
            <SourceIcon source={source} size={13} />
            <span className="truncate">{v.label ?? fallbackName(source)}</span>
          </a>
        )
      })}
    </div>
  )
}
