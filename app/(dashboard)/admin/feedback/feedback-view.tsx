"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BASE_PATH } from "@/lib/base-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useSyncedState } from "@/lib/use-synced-state"

type Item = { id: string; authorName: string; authorId: string; title: string; text: string; category: string; status: string; createdAt: string }
type Panel = { guildId: string; channelId: string; messageId: string }
const statuses = { OPEN: "Open", IN_PROGRESS: "In progress", DONE: "Done" }
const categories: Record<string, string> = { BUG: "Bug", IDEA: "Improvement", OTHER: "Other" }

export function FeedbackView({ initialItems, initialPanel, count, filter, cursor, nextCursor }: { initialItems: Item[]; initialPanel: Panel | null; count: number; filter: string; cursor?: string; nextCursor: string | null }) {
  const router = useRouter()
  const [items, setItems] = useSyncedState(initialItems)
  const [panel, setPanel] = useSyncedState(initialPanel)
  const [channelId, setChannelId] = useState(initialPanel?.channelId ?? "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  async function updateStatus(id: string, status: string) {
    setBusy(id); setError("")
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/feedback`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
      if (!response.ok) throw new Error("Could not change the status. Try again.")
      setItems(previous => previous.map(item => item.id === id ? { ...item, status } : item))
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save.") }
    finally { setBusy(null) }
  }

  async function setup(event: React.FormEvent) {
    event.preventDefault(); setBusy("panel"); setError("")
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/feedback/panel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: channelId.trim() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not set up feedback.")
      setPanel(data)
    } catch (err) { setError(err instanceof Error ? err.message : "Could not set up feedback.") }
    finally { setBusy(null) }
  }

  const visible = items.filter(item => filter === "ALL" || item.status === filter)
  return <div className="page-wide space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href="/admin" className="text-sm text-fg-muted hover:text-fg">Accounts</Link><h1 className="page-title mt-1 text-fg">App feedback</h1><p className="mt-1 text-sm text-fg-muted">Private Discord submissions · visible only to app admins</p></div>
      <Button variant="secondary" onClick={() => router.refresh()}>Refresh</Button>
    </header>
    <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <h2 className="font-semibold text-fg">Discord feedback channel</h2>
      <p className="text-sm text-fg-muted">The bot posts a message with “Feedback abgeben” and “Mein Feedback”. Submissions and confirmations stay private. Authors can check their own feedback and its status.</p>
      <form onSubmit={setup} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm text-fg-muted">Channel ID<Input aria-label="Discord channel ID" className="mt-1" value={channelId} onChange={event => setChannelId(event.target.value)} placeholder="Copy Channel ID in Discord" required pattern="[0-9]{1,20}" disabled={!!panel} /></label>
        <Button disabled={busy !== null} type="submit">{busy === "panel" ? "Setting up…" : panel ? "Update message" : "Set up feedback message"}</Button>
      </form>
      {panel && <a href={`https://discord.com/channels/${panel.guildId}/${panel.channelId}/${panel.messageId}`} target="_blank" rel="noreferrer" className="inline-block text-sm text-brand-ink hover:underline">Open feedback message in Discord ↗</a>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-fg-muted">{count} submissions in this view · up to 50 per page</p>
      <label className="flex items-center gap-2 text-sm text-fg-muted">Status<Select aria-label="Filter feedback by status" value={filter} onChange={event => router.push(`/admin/feedback?status=${event.target.value}`)}><option value="ALL">All</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
    </div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="space-y-3">
      {!visible.length && <p className="rounded-xl border border-line p-6 text-sm text-fg-muted">No feedback in this view yet.</p>}
      {visible.map(item => <article key={item.id} className="min-w-0 rounded-xl border border-line bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="text-xs text-fg-muted">{categories[item.category] ?? item.category} · {new Date(item.createdAt).toLocaleString("en-GB", { timeZone: "Europe/Berlin" })}</p><h2 className="mt-1 font-semibold text-fg break-words">{item.title}</h2><p className="mt-1 text-sm text-fg-muted break-words">{item.authorName} <span className="text-xs">({item.authorId})</span></p></div>
          <Select aria-label={`Status for ${item.title}`} value={item.status} disabled={busy !== null} onChange={event => updateStatus(item.id, event.target.value)}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-fg">{item.text}</p>
      </article>)}
    </div>
    <nav aria-label="Feedback pages" className="flex flex-wrap justify-between gap-3 text-sm text-brand-ink">
      {cursor && <Link href={`/admin/feedback?status=${filter}`}>Newest submissions</Link>}
      {nextCursor && <Link href={`/admin/feedback?status=${filter}&cursor=${encodeURIComponent(nextCursor)}`}>Older submissions →</Link>}
    </nav>
  </div>
}
