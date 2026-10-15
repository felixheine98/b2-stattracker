"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import { AVAILABILITY_LABEL, type Answer } from "@/lib/planning"
import { reactionPreview, validateReactionMapping, type ImportAnswer, type ReactionSnapshot } from "@/lib/discord-planning"
import type { PlanningState } from "@/lib/planning-db"
import type { PlanningMutate } from "@/lib/use-planning-live"

interface Preview {
  snapshot: ReactionSnapshot
  token: string
  revision: number
  identities: Record<string, string>
}

export function DiscordImport({ state, mutate }: { state: PlanningState; mutate: PlanningMutate }) {
  const [messageUrl, setMessageUrl] = useState(state.discordSettings?.messageUrl ?? "")
  const [loaded, setLoaded] = useState<Preview | null>(null)
  const [mapping, setMapping] = useState<Record<string, ImportAnswer | "">>({})
  const [identities, setIdentities] = useState<Record<string, string>>({})
  const [resolutions, setResolutions] = useState<Record<string, ImportAnswer | "">>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const api = `${BASE_PATH}/api/tournaments/${state.tournament.id}/planning/discord`
  const options = [
    ...Object.entries(AVAILABILITY_LABEL).map(([value, label]) => ({ value, label })),
    ...state.levels.map(l => ({ value: `level:${l.id}`, label: l.name })),
  ]
  const label = (value: Answer) => options.find(o => o.value === value)?.label ?? (value === "INACTIVE" ? "Inactive" : "No answer yet")
  const preview = loaded ? reactionPreview(loaded.snapshot, mapping, identities, state.rows.map(r => ({ playerId: r.player.id, answer: r.answer })), resolutions) : []
  const changes = preview.filter(r => r.kind === "change").length
  const stale = !!loaded && loaded.revision !== state.revision
  let mappingError = ""
  if (loaded) {
    try { validateReactionMapping(loaded.snapshot, mapping, identities, state.rows.map(r => r.player.id), state.levels.map(l => l.id)) }
    catch (e) { mappingError = e instanceof Error ? e.message : "Check the assignments." }
  }
  const conflicts = preview.filter(r => r.kind === "conflict").length

  async function read() {
    setBusy(true); setError(""); setSuccess(""); setLoaded(null)
    try {
      const response = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch", messageUrl }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not fetch reactions.")
      const result = data as Preview
      setLoaded(result)
      setIdentities(result.identities)
      setResolutions({})
      const saved = state.discordSettings?.emojiMapping ?? {}
      // Removed extra levels require a fresh choice instead of silently changing their meaning.
      setMapping(Object.fromEntries(result.snapshot.reactions.flatMap(r => {
        const value = saved[r.key]
        return value !== undefined && (value === "" || options.some(o => o.value === value)) ? [[r.key, value]] : []
      })))
    } catch (e) { setError(e instanceof Error ? e.message : "Could not fetch reactions.") }
    finally { setBusy(false) }
  }

  async function apply() {
    if (!loaded) return
    setBusy(true); setError(""); setSuccess("")
    const failed = await mutate(s => s, () => fetch(api, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply", token: loaded.token, emojiMapping: mapping, identities, resolutions }),
    }))
    setBusy(false)
    if (failed) setError(failed)
    else { setSuccess(`${changes} ${changes === 1 ? "answer" : "answers"} updated. Emoji and account assignments saved.`); setLoaded(null) }
  }

  return (
    <details className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-fg">Import Discord reactions</summary>
      <div className="mt-4 space-y-5">
        <p className="text-sm text-fg-muted">Read the reactions on an announcement, assign their meaning, then review the changes before updating this planning. Players without a relevant reaction keep their answer. Notes and lineups are kept.</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); read() }}>
          <label className="min-w-0 flex-1 basis-64 text-sm text-fg-soft">
            Discord message link
            <Input className="mt-1" type="url" placeholder="https://discord.com/channels/…/…/…" value={messageUrl} required disabled={busy}
              onChange={e => { setMessageUrl(e.target.value); setLoaded(null); setSuccess("") }} />
          </label>
          <Button type="submit" variant="outline" disabled={busy || !messageUrl.trim()}>{busy ? "Working…" : "Fetch reactions"}</Button>
        </form>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {success && <p role="status" className="text-sm text-fg-soft">{success}</p>}
        {loaded && <>
          <p className="text-xs text-fg-subtle">Reactions fetched {new Date(loaded.snapshot.fetchedAt).toLocaleString()}. This preview expires after 15 minutes.</p>
          <fieldset disabled={busy} className="min-w-0 space-y-3">
            <legend className="mb-2 text-sm font-semibold text-fg">1. What does each emoji mean?</legend>
            <p className="text-xs text-fg-muted">Several emojis can mean the same status. Choose Ignore for unrelated reactions.</p>
            {loaded.snapshot.reactions.length === 0 && <p className="text-sm text-fg-muted">This message has no reactions yet.</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {loaded.snapshot.reactions.map(r => <label key={r.key} className="min-w-0 space-y-1 text-sm text-fg-soft">
                <span className="flex items-center gap-2">
                  {r.imageUrl && <Image src={r.imageUrl} alt="" width={24} height={24} unoptimized />}
                  <span className="truncate">{r.label}</span><span className="text-xs text-fg-muted">({r.userIds.length})</span>
                </span>
                <Select aria-label={`Status for ${r.label}`} value={mapping[r.key] ?? "__choose__"} onChange={e => {
                  setMapping(old => ({ ...old, [r.key]: e.target.value as ImportAnswer | "" })); setResolutions({})
                }}>
                  <option value="__choose__" disabled>Choose status…</option><option value="">Ignore</option>
                  {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </label>)}
            </div>
          </fieldset>
          {loaded.snapshot.users.length > 0 && <fieldset disabled={busy} className="min-w-0 space-y-3">
            <legend className="mb-2 text-sm font-semibold text-fg">2. Assign Discord accounts</legend>
            <p className="text-xs text-fg-muted">Account links are saved for future competitions. Guests must be added to the planning first. Ignore accounts that should not be imported.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {loaded.snapshot.users.map(u => <label key={u.id} className="min-w-0 space-y-1 text-sm text-fg-soft">
                <span className="block truncate" title={`Discord ID: ${u.id}`}>{u.name} <span className="text-xs text-fg-subtle">{loaded.snapshot.reactions.filter(r => r.userIds.includes(u.id)).map(r => r.label).join(" ")}</span></span>
                <Select aria-label={`Player for ${u.name}`} value={identities[u.id] ?? "__choose__"} onChange={e => {
                  setIdentities(old => ({ ...old, [u.id]: e.target.value })); setResolutions({})
                }}>
                  <option value="__choose__" disabled>Choose player…</option><option value="">Ignore this account</option>
                  {state.rows.map(r => <option key={r.player.id} value={r.player.id} disabled={!!loaded.identities[u.id] && loaded.identities[u.id] !== r.player.id}>{r.player.name}</option>)}
                </Select>
              </label>)}
            </div>
          </fieldset>}
          {!mappingError && <fieldset disabled={busy} className="min-w-0 space-y-2">
            <legend className="mb-2 text-sm font-semibold text-fg">3. Review planning changes</legend>
            {preview.map(row => <div key={row.playerId} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm text-fg-soft">
                <span className="font-medium">{state.rows.find(r => r.player.id === row.playerId)?.player.name}</span>
                <p className="text-xs text-fg-muted">{label(row.before)} → {row.after ? label(row.after) : row.kind === "conflict" ? "Conflicting reactions" : "Keep current answer"}</p>
              </div>
              {row.candidates.length > 0 && <Select className="sm:w-56" aria-label={`Import answer for ${state.rows.find(r => r.player.id === row.playerId)?.player.name}`}
                value={resolutions[row.playerId] ?? "__choose__"} onChange={e => {
                  const value = e.target.value
                  setResolutions(old => { const next = { ...old }; if (value === "__choose__") delete next[row.playerId]; else next[row.playerId] = value as ImportAnswer | ""; return next })
                }}>
                <option value="__choose__">{row.candidates.length > 1 ? "Resolve conflict…" : "Use detected answer"}</option>
                <option value="">Keep current answer</option>
                {row.candidates.length > 1 && row.candidates.map(a => <option key={a} value={a}>{label(a)}</option>)}
              </Select>}
            </div>)}
          </fieldset>}
          {mappingError && <p className="text-sm text-fg-muted">{mappingError}</p>}
          {stale && <p role="alert" className="text-sm text-danger">The planning changed. Fetch the reactions again before applying.</p>}
          {!mappingError && conflicts > 0 && <p className="text-sm text-danger">Resolve or skip {conflicts} conflicting {conflicts === 1 ? "answer" : "answers"}.</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !!mappingError || conflicts > 0 || stale} onClick={apply}>{changes > 0 ? `Apply ${changes} ${changes === 1 ? "change" : "changes"}` : "Save assignments"}</Button>
            <Button variant="outline" disabled={busy} onClick={() => setLoaded(null)}>Cancel</Button>
          </div>
        </>}
      </div>
    </details>
  )
}
