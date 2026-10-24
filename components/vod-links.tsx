import { CloudUpload, Scissors, Video } from "lucide-react"
import { formatVodTime, readVod, twitchVideoId, type VodLink, type VodSource } from "@/lib/vod"

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

export interface VodRangeState {
  start: number
  end: number
  // The backup (lib/vod-queue.ts)
  status?: string
  error?: string | null
}

const STATUS: Record<string, { label: string; className: string }> = {
  WAITING: { label: "backup waiting", className: "text-fg-subtle" },
  LOADING: { label: "backing up…", className: "text-brand-ink" },
  DONE: { label: "backed up", className: "text-ok" },
  FAILED: { label: "backup failed", className: "text-danger" },
}

// ranges: the match's range per VOD link with its backup; onSetRange offers setting it on Twitch VODs,
// onBackUp asking for the backup by hand (dev) or again after it failed
export function VodLinks({ vods, ranges = {}, onSetRange, onBackUp }: { vods: VodLink[]; ranges?: Record<string, VodRangeState>; onSetRange?: (vod: VodLink) => void; onBackUp?: (vod: VodLink) => void }) {
  if (vods.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {vods.map((v, i) => {
        const source = readVod(v.url)?.source ?? "video"
        const range = ranges[v.url]
        return (
          <span key={i} className="inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-line bg-surface text-xs text-fg-soft hover:border-line-strong">
            <a href={v.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 px-2 py-1 hover:text-fg">
              <SourceIcon source={source} size={13} />
              <span className="truncate">{v.label ?? fallbackName(source)}</span>
              {range && <span className="shrink-0 tabular-nums text-fg-subtle">{formatVodTime(range.start)}–{formatVodTime(range.end)}</span>}
            </a>
            {range?.status && STATUS[range.status] && (
              <span className={`inline-flex items-center border-l border-line px-2 ${STATUS[range.status].className}`} title={range.error ?? undefined}>
                {STATUS[range.status].label}
              </span>
            )}
            {onBackUp && range && (range.status === "WAITING" || range.status === "FAILED") && (
              <button type="button" onClick={() => onBackUp(v)} className="border-l border-line px-2 text-fg-muted hover:bg-table-hover hover:text-fg" aria-label={range.status === "FAILED" ? "Try the backup again" : "Back up now"} title={range.status === "FAILED" ? "Try the backup again" : "Back up now"}>
                <CloudUpload size={12} />
              </button>
            )}
            {onSetRange && twitchVideoId(v.url) && (
              <button type="button" onClick={() => onSetRange(v)} className="border-l border-line px-2 text-fg-muted hover:bg-table-hover hover:text-fg" aria-label={range ? "Change the range of the match" : "Set the range of the match"} title={range ? "Change the range of the match" : "Set the range of the match"}>
                <Scissors size={12} />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
