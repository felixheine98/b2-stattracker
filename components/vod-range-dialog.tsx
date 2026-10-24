"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BASE_PATH } from "@/lib/base-path"
import { formatVodTime, rangeError, twitchVideoId, vodStart, type VodLink } from "@/lib/vod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"

export interface VodRange {
  start: number
  end: number
}

// The Twitch embed player (https://dev.twitch.tv/docs/embed/video-and-clips/), loaded on demand
interface TwitchPlayer {
  addEventListener(event: string, callback: () => void): void
  getCurrentTime(): number
  getDuration(): number
  seek(seconds: number): void
  pause(): void
}
declare global {
  interface Window {
    Twitch?: { Player: { new (element: HTMLElement | string, options: object): TwitchPlayer; READY: string } }
  }
}

let embedScript: Promise<void> | null = null
function loadTwitchEmbed(): Promise<void> {
  embedScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://player.twitch.tv/js/embed/v1.js"
    script.onload = () => resolve()
    script.onerror = () => { embedScript = null; reject(new Error("The Twitch player could not be loaded.")) }
    document.head.appendChild(script)
  })
  return embedScript
}

// Setting the range of a match within a Twitch VOD (docs/adr/011-vod-archiv.md): the VOD plays above
// a slider with two bounds; dragging a bound seeks the player there
export function VodRangeDialog({ competitionId, matchId, vod, range, onClose }: { competitionId: string; matchId: string; vod: VodLink; range: VodRange | null; onClose: () => void }) {
  const router = useRouter()
  const holder = useRef<HTMLDivElement>(null)
  const player = useRef<TwitchPlayer | null>(null)
  const [length, setLength] = useState<number | null>(null)
  const [start, setStart] = useState(range?.start ?? vodStart(vod.url) ?? 0)
  const [end, setEnd] = useState(range?.end ?? (range?.start ?? vodStart(vod.url) ?? 0) + 45 * 60)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false, poll: ReturnType<typeof setInterval> | undefined
    loadTwitchEmbed().then(() => {
      if (cancelled || !holder.current || !window.Twitch) return
      holder.current.innerHTML = ""
      const p = new window.Twitch.Player(holder.current, { video: twitchVideoId(vod.url), parent: [window.location.hostname], width: "100%", height: "100%", autoplay: false, time: `${Math.floor(start)}s` })
      player.current = p
      // The length is known once the player has loaded the VOD
      poll = setInterval(() => {
        const d = p.getDuration()
        if (d > 0) { setLength(Math.floor(d)); clearInterval(poll) }
      }, 500)
    }).catch((e) => setError(e.message))
    return () => { cancelled = true; clearInterval(poll); player.current = null }
    // The player is set up once per dialog; the start only decides where it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vod.url])

  const seek = (at: number) => player.current?.seek(at)
  const now = () => Math.floor(player.current?.getCurrentTime() ?? 0)
  // Until the length is known, the slider reaches an hour past the range
  const max = length ?? Math.max(end, start) + 3600
  const problem = rangeError(start, end, length ?? undefined)

  async function save() {
    setBusy(true); setError("")
    try {
      const r = await fetch(`${BASE_PATH}/api/tournaments/${competitionId}/matches/${matchId}/vod-clip`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: vod.url, start, end }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      router.refresh(); onClose()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const bound = (label: string, value: number, set: (v: number) => void) => (
    <div className="space-y-1.5">
      <p className="text-xs text-fg-muted">{label} <span className="font-semibold tabular-nums text-fg">{formatVodTime(value)}</span></p>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => set(now())}>{label} here</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { const v = Math.max(0, value - 5); set(v); seek(v) }}>−5 s</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { const v = Math.min(max, value + 5); set(v); seek(v) }}>+5 s</Button>
      </div>
    </div>
  )

  return (
    <Dialog open onClose={onClose} className="md:max-w-3xl">
      <DialogTitle>Range of the match</DialogTitle>
      <div className="space-y-4">
        <div ref={holder} className="aspect-video w-full overflow-hidden rounded-lg bg-black" />
        <RangeSlider max={max} start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e) }} onSeek={seek} />
        <p className="text-center text-sm tabular-nums text-fg-soft">
          {formatVodTime(start)} – {formatVodTime(end)} <span className="text-fg-subtle">({formatVodTime(Math.max(0, end - start))}{length === null ? ", loading the VOD's length…" : ` of ${formatVodTime(length)}`})</span>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {bound("Start", start, setStart)}
          {bound("End", end, setEnd)}
        </div>
        <p className="text-xs text-fg-subtle">Once saved, this part of the VOD is backed up to the team&apos;s YouTube channel as an unlisted video.</p>
        {(error || problem) && <p className="text-sm text-danger" role="alert">{error || problem}</p>}
        <div className="dialog-footer flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={busy || !!problem} onClick={save}>Save range</Button>
        </div>
      </div>
    </Dialog>
  )
}

// Two bounds on a bar over the whole VOD: drag a bound to move it, drag the range between them to
// shift both; arrow keys move a bound by a second, with Shift by ten
function RangeSlider({ max, start, end, onChange, onSeek }: { max: number; start: number; end: number; onChange: (start: number, end: number) => void; onSeek: (at: number) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ what: "start" | "end" | "range"; from: number; start: number; end: number } | null>(null)
  const at = (clientX: number) => {
    const box = track.current!.getBoundingClientRect()
    return Math.round(Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * max)
  }
  const pct = (v: number) => `${(Math.min(v, max) / max) * 100}%`

  // What is dragged comes from the element's data-bound
  const down = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { what: e.currentTarget.dataset.bound as "start" | "end" | "range", from: at(e.clientX), start, end }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const x = at(e.clientX)
    if (d.what === "start") onChange(Math.min(x, d.end - 1), d.end)
    else if (d.what === "end") onChange(d.start, Math.max(x, d.start + 1))
    else {
      const shift = Math.min(Math.max(x - d.from, -d.start), max - d.end)
      onChange(d.start + shift, d.end + shift)
    }
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (d) onSeek(d.what === "end" ? end : start)
  }
  const key = (e: React.KeyboardEvent<HTMLElement>) => {
    const what = e.currentTarget.dataset.bound
    const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0)
    if (!step) return
    e.preventDefault()
    if (what === "start") { const v = Math.min(Math.max(0, start + step), end - 1); onChange(v, end); onSeek(v) }
    else { const v = Math.max(Math.min(max, end + step), start + 1); onChange(start, v); onSeek(v) }
  }
  const thumb = "absolute top-1/2 h-7 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-sm border-2 border-brand-ink bg-surface shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"

  return (
    <div className="px-1.5 py-3">
      <div ref={track} className="relative h-2.5 rounded-full bg-line select-none" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="absolute inset-y-0 cursor-grab touch-none rounded-full bg-brand-ink/60 active:cursor-grabbing" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} data-bound="range" onPointerDown={down} onPointerMove={move} onPointerUp={up} />
        <div role="slider" tabIndex={0} aria-label="Start" aria-valuemin={0} aria-valuemax={max} aria-valuenow={start} aria-valuetext={formatVodTime(start)} className={thumb} style={{ left: pct(start) }} data-bound="start" onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={key} />
        <div role="slider" tabIndex={0} aria-label="End" aria-valuemin={0} aria-valuemax={max} aria-valuenow={end} aria-valuetext={formatVodTime(end)} className={thumb} style={{ left: pct(end) }} data-bound="end" onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={key} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-fg-subtle">
        <span>0:00</span>
        <span>{formatVodTime(max)}</span>
      </div>
    </div>
  )
}
