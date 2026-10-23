"use client"

import { useState } from "react"
import Image from "next/image"
import { ExternalLink, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import { formatTime, formatTimeShort, previewSummary, type ReactionSnapshot } from "@/lib/discord-planning"
import { matchdayReactionPreview, type EmojiChoice, type ServerEmoji } from "@/lib/matchday-discord"
import { AnnouncementForm } from "./announcement-form"
import type { MatchdayAnswer } from "@/lib/matchday-plan"
import type { MatchdayDiscordSettings } from "@/lib/matchday-plan-db"
import { shownName } from "@/lib/player-names"

// The matchday announcement of a lineup (docs/adr/008): the lineup channel once, the marked ping of
// the match day, and its reactions as answers: taken over at once on fetching, with the list of
// changes to look at. A preview stays only where a choice is missing. Accounts are not linked here.

interface Ping {
  messageUrl: string
  postedAt: string
  author: string | null
  text: string
}

interface Loaded {
  snapshot: ReactionSnapshot
  token: string
  revision: number
  links: Record<string, string>
  notAPlayer: string[]
}

type Mapping = Record<string, MatchdayAnswer | "">

// What a fetch took over at once
interface Synced {
  applied: Array<{ playerId: string; before: MatchdayAnswer | null; after: MatchdayAnswer; time: string | null }>
  unlinked: Array<{ id: string; name: string }>
  // The fetch, to open as a preview for changing what the emojis mean
  loaded: Loaded
}

const LABEL: Record<MatchdayAnswer, string> = { FIX: "Fix", PARTIAL: "Partly", MAYBE: "Maybe", OUT: "Out" }

interface Props {
  // The planning's API, e.g. /api/tournaments/…/lineups/…/plan/…
  apiPath: string
  channelId: string | null
  settings: MatchdayDiscordSettings | null
  kader: Array<{ id: string; name: string; nickname?: string | null }>
  answers: Record<string, MatchdayAnswer | null>
  revision: number
  // Loads the planning again after answers were applied
  onApplied: () => Promise<void>
  // The match day, for the text of an announcement the bot posts
  stage: string
  day: string
}

export function MatchdayDiscord({ apiPath, channelId: initialChannel, settings, kader, answers, revision, onApplied, stage, day }: Props) {
  // The announcement being written: the server's emojis and the lineup's last ones; null while none is
  const [writing, setWriting] = useState<{ server: ServerEmoji[]; lastUsed: EmojiChoice[] } | null>(null)
  const [channelId, setChannelId] = useState(initialChannel)
  const [editingChannel, setEditingChannel] = useState(!initialChannel)
  const [channelLink, setChannelLink] = useState("")
  const [messageUrl, setMessageUrl] = useState(settings?.messageUrl ?? "")
  const [fetchedAt, setFetchedAt] = useState(settings?.fetchedAt ?? "")
  const [mapping, setMapping] = useState<Mapping>(settings?.emojiMapping ?? {})
  const [pings, setPings] = useState<{ announcements: Ping[]; suggested: string | null; taken: string[] } | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [resolutions, setResolutions] = useState<Mapping>({})
  const [editingEmojis, setEditingEmojis] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [synced, setSynced] = useState<Synced | null>(null)
  const [showChanges, setShowChanges] = useState(false)

  async function call(body: Record<string, unknown>) {
    const response = await fetch(`${BASE_PATH}${apiPath}/discord`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? "Discord request failed.")
    return data
  }

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(""); setSuccess(""); setSynced(null); setShowChanges(false)
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : "Discord request failed.") } finally { setBusy(false) }
  }

  const saveChannel = () => run(async () => {
    const data = await call({ action: "channel", link: channelLink })
    setChannelId(data.channelId); setEditingChannel(false); setChannelLink(""); setPings(null)
  })

  // The bot posts the announcement with its emojis; it is this match day's at once
  const write = () => run(async () => {
    setPings(null)
    setWriting(await call({ action: "emojis" }))
  })

  const post = (text: string, emojis: EmojiChoice[]) => run(async () => {
    const data = await call({ action: "post", text, emojis })
    setMessageUrl(data.messageUrl); setMapping(data.emojiMapping); setFetchedAt(""); setWriting(null); setLoaded(null)
    setSuccess("The bot posted the announcement. Reactions to it come with their time.")
  })

  async function findPings() {
    setPings(await call({ action: "announcements" }))
  }

  const choosePing = (url: string) => run(async () => {
    await call({ action: "choose", messageUrl: url })
    setMessageUrl(url); setPings(null); setLoaded(null)
  })

  // Fetching takes over every clear answer at once; only new emojis or players with two answers
  // leave a preview to choose in
  const read = () => run(async () => {
    const data = await call({ action: "sync" })
    setFetchedAt(data.snapshot.fetchedAt); setResolutions({}); setEditingEmojis(false)
    if (data.applied === null) { setLoaded(data); return }
    await onApplied()
    setSynced({ applied: data.applied, unlinked: data.unlinked, loaded: data })
    setLoaded(data.conflicts.length > 0 ? data : null)
  })

  // Saved at once, so the choice is there next time even without applying anything
  async function choose(key: string, value: MatchdayAnswer | "") {
    const next = { ...mapping, [key]: value }
    setMapping(next); setResolutions({})
    await call({ action: "settings", emojiMapping: next }).catch(() => setError("The emoji choice could not be saved."))
  }

  const kaderAnswers = kader.map((p) => ({ playerId: p.id, answer: answers[p.id] ?? null }))
  const preview = loaded ? matchdayReactionPreview(loaded.snapshot, mapping, loaded.links, loaded.notAPlayer, kaderAnswers, resolutions) : null
  const summary = previewSummary(preview?.rows ?? [])
  const unmapped = loaded ? loaded.snapshot.reactions.filter((r) => !Object.hasOwn(mapping, r.key)) : []
  const emojiRows = loaded ? (editingEmojis ? loaded.snapshot.reactions : unmapped) : []
  const stale = !!loaded && loaded.revision !== revision
  const rows = preview?.rows.filter((r) => r.kind === "change" || r.kind === "conflict" || (r.kind === "skipped" && r.candidates.length > 0)) ?? []
  const nameOf = (id: string) => {
    const player = kader.find((p) => p.id === id)
    return player ? shownName(player) : "Unknown"
  }
  const label = (value: MatchdayAnswer | null | "") => (value ? LABEL[value] : value === "" ? "Ignore" : "No answer")

  const apply = () => run(async () => {
    if (!loaded) return
    await call({ action: "apply", token: loaded.token, emojiMapping: mapping, resolutions })
    setSuccess(`${summary.changes} ${summary.changes === 1 ? "answer" : "answers"} updated.`)
    setLoaded(null)
    await onApplied()
  })

  return (
    <section aria-label="Discord" className="min-w-0 space-y-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-fg"><MessageCircle size={14} /> Discord</h3>
        {messageUrl && !editingChannel && (
          <a href={messageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
            Announcement <ExternalLink size={12} />
          </a>
        )}
        {channelId && !editingChannel && (
          <button type="button" className="ml-auto text-xs text-fg-subtle hover:text-fg" disabled={busy} onClick={() => setEditingChannel(true)}>
            Lineup channel
          </button>
        )}
      </div>

      {editingChannel && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void saveChannel() }}>
          <label className="min-w-0 flex-1 basis-56 text-xs text-fg-soft">
            Link to the lineup&apos;s channel (or a message in it), kept for every match day
            <Input className="mt-1" type="url" placeholder="https://discord.com/channels/…/…" value={channelLink} required disabled={busy} onChange={(e) => setChannelLink(e.target.value)} />
          </label>
          <Button type="submit" size="sm" variant="outline" disabled={busy || !channelLink.trim()}>Save</Button>
          {channelId && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditingChannel(false)}>Cancel</Button>}
        </form>
      )}

      {writing && (
        <AnnouncementForm stage={stage} day={day} server={writing.server} lastUsed={writing.lastUsed} busy={busy} onPost={post} onCancel={() => setWriting(null)} />
      )}

      {channelId && !editingChannel && !pings && !writing && (
        <div className="flex flex-wrap items-center gap-2">
          {messageUrl ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={read}>{busy ? "Working…" : "Fetch reactions"}</Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={write}>Post announcement</Button>
          )}
          <Button size="sm" variant={messageUrl ? "ghost" : "outline"} disabled={busy} onClick={() => run(findPings)}>
            {messageUrl ? "Other announcement" : "Find announcement"}
          </Button>
          {messageUrl && (
            <p role="status" className="w-full text-xs text-fg-muted">
              {fetchedAt ? <>Last fetched: <time dateTime={fetchedAt} className="text-fg-soft">{formatTime(fetchedAt)}</time></> : "Not fetched yet"}
            </p>
          )}
        </div>
      )}

      {pings && (
        <div className="space-y-2">
          <p className="text-xs text-fg-muted">
            {pings.announcements.length === 0 ? "No ping in the lineup channel marks the bot yet. Mention the bot in the weekly ping." : "Pings in the lineup channel that mark the bot:"}
          </p>
          {[...pings.announcements].sort((a, b) => Number(b.messageUrl === pings.suggested) - Number(a.messageUrl === pings.suggested)).map((ping) => {
            const suggested = ping.messageUrl === pings.suggested
            const taken = pings.taken.includes(ping.messageUrl)
            return (
              <div key={ping.messageUrl} className={`flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center ${suggested ? "border-brand/60 bg-brand/5" : "border-line"}`}>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="text-fg-soft">
                    {formatTime(ping.postedAt)}{ping.author ? ` · ${ping.author}` : ""}
                    {suggested && <span className="text-brand-ink"> · suggested</span>}
                    {taken && <span className="text-fg-subtle"> · used by another match day</span>}
                  </p>
                  {ping.text && <p className="truncate text-fg-muted" title={ping.text}>{ping.text}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={ping.messageUrl} target="_blank" rel="noreferrer" aria-label="Open in Discord" className="inline-flex items-center px-1 text-fg-subtle hover:text-fg"><ExternalLink size={13} /></a>
                  <Button size="sm" variant={suggested ? "default" : "outline"} disabled={busy || ping.messageUrl === messageUrl} onClick={() => choosePing(ping.messageUrl)}>
                    {ping.messageUrl === messageUrl ? "In use" : "Use this"}
                  </Button>
                </div>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={write}>Post a new announcement</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPings(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {success && <p role="status" className="text-sm text-fg-soft">{success}</p>}

      {synced && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-fg-soft">
            {synced.applied.length === 0 ? "No answers changed." : `${synced.applied.length} ${synced.applied.length === 1 ? "answer" : "answers"} updated.`}
            {synced.applied.length > 0 && <> <button type="button" className="text-xs text-fg-muted underline-offset-2 hover:underline" onClick={() => setShowChanges((v) => !v)}>{showChanges ? "Hide changes" : "Show changes"}</button></>}
            {!loaded && synced.loaded.snapshot.reactions.length > 0 && <> · <button type="button" className="text-xs text-fg-muted underline-offset-2 hover:underline" onClick={() => { setLoaded(synced.loaded); setEditingEmojis(true) }}>emojis</button></>}
          </p>
          {showChanges && (
            <ul className="space-y-1 rounded-lg border border-line px-3 py-2 text-sm text-fg-soft">
              {synced.applied.map((c) => (
                <li key={c.playerId}>
                  <span className="font-medium">{nameOf(c.playerId)}</span>: {label(c.before)} → {label(c.after)}
                  {c.time && <span className="text-xs text-fg-muted"> · {formatTimeShort(c.time)}</span>}
                </li>
              ))}
            </ul>
          )}
          {!loaded && synced.unlinked.length > 0 && (
            <p className="text-xs text-fg-muted">
              Not imported, the Discord account is not linked to a player: {synced.unlinked.map((u) => u.name).join(", ")}. An admin or manager has to link {synced.unlinked.length === 1 ? "it" : "them"} under Discord accounts.
            </p>
          )}
        </div>
      )}

      {loaded && preview && (
        <div className="space-y-3">
          {loaded.snapshot.trackedSince && <p className="text-xs text-fg-muted">The time of a reaction is known from {formatTime(loaded.snapshot.trackedSince)} on.</p>}
          {loaded.snapshot.reactions.length === 0 && <p className="text-sm text-fg-muted">The announcement has no reactions yet.</p>}
          {emojiRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-fg-muted">{editingEmojis ? "What each emoji means on this match day:" : "New emojis – what do they mean?"}</p>
              {emojiRows.map((r) => (
                <label key={r.key} className="flex min-w-0 items-center gap-2 text-sm text-fg-soft">
                  <span className="flex w-16 shrink-0 items-center gap-1">
                    {r.imageUrl ? <Image src={r.imageUrl} alt="" width={20} height={20} unoptimized /> : <span>{r.label}</span>}
                    <span className="text-xs text-fg-muted">{r.userIds.length}</span>
                  </span>
                  <Select aria-label={`Answer for ${r.label}`} value={Object.hasOwn(mapping, r.key) ? mapping[r.key] : "__choose__"} disabled={busy} onChange={(e) => choose(r.key, e.target.value as MatchdayAnswer | "")}>
                    <option value="__choose__" disabled>Choose…</option>
                    <option value="">Ignore</option>
                    {(Object.keys(LABEL) as MatchdayAnswer[]).map((a) => <option key={a} value={a}>{LABEL[a]}</option>)}
                  </Select>
                </label>
              ))}
              {editingEmojis && <Button size="sm" variant="ghost" onClick={() => setEditingEmojis(false)}>Done</Button>}
            </div>
          )}

          {unmapped.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-fg-soft">
                {summary.changes} {summary.changes === 1 ? "change" : "changes"}
                {summary.conflicts > 0 && <span className="text-danger"> · {summary.conflicts} {summary.conflicts === 1 ? "conflict" : "conflicts"}</span>}
                {" · "}{summary.unchanged} unchanged · {summary.withoutReaction} without reaction
                {!editingEmojis && loaded.snapshot.reactions.length > 0 && <> · <button type="button" className="underline-offset-2 hover:underline" onClick={() => setEditingEmojis(true)}>emojis</button></>}
              </p>
              {rows.map((row) => (
                <div key={row.playerId} className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 text-sm text-fg-soft">
                    <span className="font-medium">{nameOf(row.playerId)}</span>: {label(row.before)} →{" "}
                    {row.after ? label(row.after) : row.kind === "conflict" ? <span className="text-danger">conflicting reactions</span> : "kept"}
                    {row.after && row.times[row.after] && <span className="text-xs text-fg-muted"> · {formatTimeShort(row.times[row.after]!)}</span>}
                  </p>
                  {row.candidates.length > 1 ? (
                    <Select className="sm:w-44" aria-label={`Answer for ${nameOf(row.playerId)}`} value={resolutions[row.playerId] ?? "__choose__"} onChange={(e) => setResolutions((old) => ({ ...old, [row.playerId]: e.target.value as MatchdayAnswer | "" }))}>
                      <option value="__choose__" disabled>Resolve…</option>
                      <option value="">Keep current answer</option>
                      {row.candidates.map((a) => <option key={a} value={a}>{LABEL[a]}{row.times[a] ? ` · ${formatTimeShort(row.times[a]!)}` : ""}</option>)}
                    </Select>
                  ) : (
                    <label className="flex items-center gap-2 text-xs text-fg-muted">
                      <input type="checkbox" checked={row.kind === "skipped"} onChange={(e) => setResolutions((old) => {
                        const next = { ...old }
                        if (e.target.checked) next[row.playerId] = ""
                        else delete next[row.playerId]
                        return next
                      })} /> Skip
                    </label>
                  )}
                </div>
              ))}
              {preview.unlinked.length > 0 && (
                <p className="text-xs text-fg-muted">
                  Not imported, the Discord account is not linked to a player: {preview.unlinked.map((u) => u.name).join(", ")}. An admin or manager has to link {preview.unlinked.length === 1 ? "it" : "them"} under Discord accounts.
                </p>
              )}
            </div>
          )}
          {stale && <p role="alert" className="text-sm text-danger">The answers changed. Fetch the reactions again before applying.</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || unmapped.length > 0 || summary.conflicts > 0 || stale || summary.changes === 0} onClick={apply}>
              {summary.changes > 0 ? `Apply ${summary.changes} ${summary.changes === 1 ? "change" : "changes"}` : "Nothing to apply"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setLoaded(null)}>Close</Button>
          </div>
        </div>
      )}
    </section>
  )
}
