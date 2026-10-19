"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import { AVAILABILITY_LABEL, type Answer } from "@/lib/planning"
import { suggestPlayer } from "@/lib/discord-accounts"
import { importIdentities, previewSummary, reactionPreview, unknownAccounts, validateReactionMapping, type ImportAnswer, type ReactionSnapshot } from "@/lib/discord-planning"
import type { PlanningState } from "@/lib/planning-db"
import type { PlanningMutate } from "@/lib/use-planning-live"

interface Preview {
  snapshot: ReactionSnapshot
  token: string
  revision: number
  identities: Record<string, string>
  links: Record<string, string>
  notAPlayer: string[]
}
type Mapping = Record<string, ImportAnswer | "">
const NOT_A_PLAYER = "__not_a_player__"

// Saved keys are "unicode:✅" or "custom:<id>"; custom emojis are shown from Discord's CDN.
function Emoji({ id, label }: { id: string; label?: string }) {
  if (id.startsWith("custom:")) return <Image src={`https://cdn.discordapp.com/emojis/${id.slice(7)}.png`} alt={label ?? ""} title={label} width={18} height={18} unoptimized className="inline-block" />
  return <span>{id.replace(/^unicode:/, "")}</span>
}

export function DiscordImport({ state, mutate }: { state: PlanningState; mutate: PlanningMutate }) {
  const [messageUrl, setMessageUrl] = useState(state.discordSettings?.messageUrl ?? "")
  const [savedUrl, setSavedUrl] = useState(state.discordSettings?.messageUrl ?? "")
  const [editingUrl, setEditingUrl] = useState(!state.discordSettings?.messageUrl)
  const [mapping, setMapping] = useState<Mapping>(state.discordSettings?.emojiMapping ?? {})
  const [editingEmojis, setEditingEmojis] = useState(false)
  const [loaded, setLoaded] = useState<Preview | null>(null)
  // Choices for accounts without a link: a player id or NOT_A_PLAYER; left open, the account is not imported
  const [accountChoices, setAccountChoices] = useState<Record<string, string>>({})
  const [resolutions, setResolutions] = useState<Mapping>({})
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const api = `${BASE_PATH}/api/tournaments/${state.tournament.id}/planning/discord`
  const options = [
    ...Object.entries(AVAILABILITY_LABEL).map(([value, label]) => ({ value, label })),
    ...state.levels.map(l => ({ value: `level:${l.id}`, label: l.name })),
  ]
  const label = (value: Answer | ImportAnswer | "") => value === "" ? "Ignore" : options.find(o => o.value === value)?.label ?? (value === "INACTIVE" ? "Inactive" : "No answer yet")
  const known = (value: string | undefined) => value !== undefined && (value === "" || options.some(o => o.value === value))
  const playerName = (id: string) => state.rows.find(r => r.player.id === id)?.player.name ?? ""

  const unmapped = loaded ? loaded.snapshot.reactions.filter(r => !known(mapping[r.key])) : []
  const unknown = loaded ? unknownAccounts(loaded.snapshot, mapping, loaded.links, loaded.notAPlayer) : []
  // A suggestion is preselected; applying the import confirms it
  const suggestions: Record<string, string> = Object.fromEntries(unknown.flatMap(u => {
    const id = suggestPlayer({ name: u.name, username: "" }, state.rows.map(r => ({ id: r.player.id, names: [r.player.name], linked: Object.values(loaded?.links ?? {}).includes(r.player.id) })))
    return id ? [[u.id, id]] : []
  }))
  const effective = { ...suggestions, ...accountChoices }
  const chosenLinks = Object.fromEntries(Object.entries(effective).filter(([id, v]) => v && v !== NOT_A_PLAYER && unknown.some(u => u.id === id)))
  const chosenNonPlayers = Object.entries(effective).filter(([id, v]) => v === NOT_A_PLAYER && unknown.some(u => u.id === id)).map(([id]) => id)
  const identities = loaded ? importIdentities(loaded.identities, chosenLinks) : {}
  const preview = loaded ? reactionPreview(loaded.snapshot, mapping, identities, state.rows.map(r => ({ playerId: r.player.id, answer: r.answer })), resolutions) : []
  const summary = previewSummary(preview)
  const stale = !!loaded && loaded.revision !== state.revision
  let mappingError = ""
  if (loaded) {
    try { validateReactionMapping(loaded.snapshot, mapping, identities, state.rows.map(r => r.player.id), state.levels.map(l => l.id)) }
    catch (e) { mappingError = e instanceof Error ? e.message : "Check the assignments." }
  }

  async function read() {
    setBusy(true); setError(""); setSuccess(""); setLoaded(null)
    try {
      const response = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch", messageUrl }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not fetch reactions.")
      setLoaded(data as Preview)
      setSavedUrl(data.snapshot.messageUrl); setMessageUrl(data.snapshot.messageUrl); setEditingUrl(false)
      setAccountChoices({}); setResolutions({}); setShowUnchanged(false)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not fetch reactions.") }
    finally { setBusy(false) }
  }

  // Saved at once, so the choice is there next time even without applying anything.
  async function choose(key: string, value: ImportAnswer | "") {
    const next = { ...mapping, [key]: value }
    setMapping(next); setResolutions({})
    const response = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "settings", emojiMapping: next }) }).catch(() => null)
    if (!response?.ok) setError("The emoji choice could not be saved.")
  }

  async function apply() {
    if (!loaded) return
    setBusy(true); setError(""); setSuccess("")
    const failed = await mutate(s => s, () => fetch(api, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply", token: loaded.token, emojiMapping: mapping, links: chosenLinks, notAPlayer: chosenNonPlayers, resolutions }),
    }))
    setBusy(false)
    if (failed) setError(failed)
    else { setSuccess(`${summary.changes} ${summary.changes === 1 ? "answer" : "answers"} updated.`); setLoaded(null) }
  }

  const savedEmojis = Object.entries(mapping).filter(([, v]) => known(v) && v !== "")
  const emojiRows = loaded ? (editingEmojis ? loaded.snapshot.reactions : unmapped) : []
  const rows = preview.filter(r => r.kind === "change" || r.kind === "conflict" || (r.kind === "skipped" && r.candidates.length > 0) || (showUnchanged && r.kind === "unchanged"))

  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold text-fg">Discord reactions</h2>
        {!editingUrl && savedUrl && <a href={savedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">Announcement <ExternalLink size={13} /></a>}
        {savedEmojis.length > 0 && <span className="flex flex-wrap items-center gap-x-2 text-sm text-fg-soft">
          {savedEmojis.map(([key, value]) => <span key={key} className="inline-flex items-center gap-1"><Emoji id={key} /> {label(value)}</span>)}
        </span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {!editingUrl && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditingUrl(true); setEditingEmojis(true) }}>Edit</Button>}
          {!editingUrl && <Button size="sm" variant="outline" disabled={busy} onClick={read}>{busy ? "Working…" : "Fetch reactions"}</Button>}
        </div>
      </div>

      {editingUrl && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); read() }}>
        <label className="min-w-0 flex-1 basis-64 text-sm text-fg-soft">
          Announcement link
          <Input className="mt-1" type="url" placeholder="https://discord.com/channels/…/…/…" value={messageUrl} required disabled={busy}
            onChange={e => { setMessageUrl(e.target.value); setLoaded(null); setSuccess("") }} />
        </label>
        <Button type="submit" variant="outline" disabled={busy || !messageUrl.trim()}>{busy ? "Working…" : "Fetch reactions"}</Button>
        {savedUrl && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setEditingUrl(false); setMessageUrl(savedUrl) }}>Cancel</Button>}
      </form>}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {success && <p role="status" className="text-sm text-fg-soft">{success}</p>}

      {loaded && <div className="space-y-4">
        {loaded.snapshot.reactions.length === 0 && <p className="text-sm text-fg-muted">This message has no reactions yet.</p>}
        {emojiRows.length > 0 && <div className="space-y-2">
          <p className="text-xs text-fg-muted">{editingEmojis ? "What each emoji means for this comp:" : "New emojis – what do they mean?"}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {emojiRows.map(r => <label key={r.key} className="flex min-w-0 items-center gap-2 text-sm text-fg-soft">
              <span className="flex w-20 shrink-0 items-center gap-1">{r.imageUrl ? <Image src={r.imageUrl} alt="" width={20} height={20} unoptimized /> : <span>{r.label}</span>}<span className="text-xs text-fg-muted">{r.userIds.length}</span></span>
              <Select aria-label={`Status for ${r.label}`} value={known(mapping[r.key]) ? mapping[r.key] : "__choose__"} disabled={busy} onChange={e => choose(r.key, e.target.value as ImportAnswer | "")}>
                <option value="__choose__" disabled>Choose…</option><option value="">Ignore</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </label>)}
          </div>
          {editingEmojis && <Button size="sm" variant="ghost" onClick={() => setEditingEmojis(false)}>Done</Button>}
        </div>}

        {unknown.length > 0 && !unmapped.length && <div className="space-y-2">
          <p className="text-xs text-fg-muted">{unknown.length} unlinked {unknown.length === 1 ? "account" : "accounts"} reacted. Links are kept for future comps; left open, an account is not imported this time. Guests must be on the planning first. <Link href="/players/discord" className="underline hover:text-fg">All Discord accounts</Link></p>
          {unknown.map(u => {
            const value = effective[u.id] ?? ""
            return <div key={u.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="min-w-0 flex-1 truncate text-sm text-fg-soft" title={`Discord ID: ${u.id}`}>{u.name} <span className="text-xs text-fg-subtle">{loaded.snapshot.reactions.filter(r => r.userIds.includes(u.id)).map(r => r.label).join(" ")}</span></span>
              <Select className="sm:w-64" aria-label={`Player for ${u.name}`} value={value} disabled={busy} onChange={e => { setAccountChoices(old => ({ ...old, [u.id]: e.target.value })); setResolutions({}) }}>
                <option value="">Not imported this time</option>
                <option value={NOT_A_PLAYER}>Not a player (always skip)</option>
                {state.rows.map(r => <option key={r.player.id} value={r.player.id}>{r.player.name}{r.player.id === suggestions[u.id] ? " (suggested)" : ""}</option>)}
              </Select>
            </div>
          })}
        </div>}

        {!mappingError && !unmapped.length && <div className="space-y-2">
          <p className="text-sm text-fg-soft">
            {summary.changes} {summary.changes === 1 ? "change" : "changes"}{summary.conflicts > 0 && <span className="text-danger"> · {summary.conflicts} {summary.conflicts === 1 ? "conflict" : "conflicts"}</span>}
            {" · "}<button type="button" className="underline-offset-2 hover:underline" onClick={() => setShowUnchanged(v => !v)}>{summary.unchanged} unchanged</button>
            {" · "}{summary.withoutReaction} without reaction
          </p>
          {rows.map(row => <div key={row.playerId} className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-sm text-fg-soft">
              <span className="font-medium">{playerName(row.playerId)}</span>: {label(row.before)} → {row.after ? label(row.after) : row.kind === "conflict" ? <span className="text-danger">conflicting reactions</span> : row.kind === "skipped" ? "kept" : label(row.before)}
            </p>
            {row.kind === "conflict" || (row.kind === "skipped" && row.candidates.length > 1) || (resolutions[row.playerId] !== undefined && row.candidates.length > 1) ? (
              <Select className="sm:w-56" aria-label={`Import answer for ${playerName(row.playerId)}`} value={resolutions[row.playerId] ?? "__choose__"} onChange={e => {
                const value = e.target.value
                setResolutions(old => { const next = { ...old }; if (value === "__choose__") delete next[row.playerId]; else next[row.playerId] = value as ImportAnswer | ""; return next })
              }}>
                <option value="__choose__" disabled>Resolve…</option>
                <option value="">Keep current answer</option>
                {row.candidates.map(a => <option key={a} value={a}>{label(a)}</option>)}
              </Select>
            ) : (row.kind === "change" || row.kind === "skipped") && (
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                <input type="checkbox" checked={row.kind === "skipped"} onChange={e => setResolutions(old => {
                  const next = { ...old }; if (e.target.checked) next[row.playerId] = ""; else delete next[row.playerId]; return next
                })} /> Skip
              </label>
            )}
          </div>)}
        </div>}
        {mappingError && !unmapped.length && <p className="text-sm text-fg-muted">{mappingError}</p>}
        {stale && <p role="alert" className="text-sm text-danger">The planning changed. Fetch the reactions again before applying.</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !!mappingError || unmapped.length > 0 || summary.conflicts > 0 || stale || (summary.changes === 0 && !Object.keys(chosenLinks).length && !chosenNonPlayers.length)} onClick={apply}>
            {summary.changes > 0 ? `Apply ${summary.changes} ${summary.changes === 1 ? "change" : "changes"}` : "Save account links"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setLoaded(null)}>Close</Button>
        </div>
      </div>}
    </section>
  )
}
