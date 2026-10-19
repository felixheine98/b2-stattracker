"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BASE_PATH } from "@/lib/base-path"
import { formatTime } from "@/lib/discord-planning"
import type { TrackedRow } from "@/lib/reaction-log"

// The messages the bot writes reaction times down for. Messages that are no comp's announcement
// can go: the bot forgets them (on Discord they stay) and ignores them until they are fetched again.
export function ReactionLog({ rows, error }: { rows: TrackedRow[]; error: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")
  const unused = rows.filter(r => !r.usedBy)

  async function remove(messageIds: string[]) {
    setBusy(true); setFailure("")
    const response = await fetch(`${BASE_PATH}/api/players/discord/reaction-log`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageIds }) }).catch(() => null)
    const data = await response?.json().catch(() => ({}))
    setBusy(false)
    if (!response?.ok) { setFailure(data?.error ?? "Could not remove."); return }
    router.refresh()
  }

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold text-fg">Tracked messages</h2>
        <span className="text-xs text-fg-muted">The bot writes down when reactions come in for these. Removing one does not touch the message on Discord.</span>
        {unused.length > 0 && <Button size="sm" variant="outline" className="ml-auto" disabled={busy}
          onClick={() => { if (confirm(`Remove ${unused.length} ${unused.length === 1 ? "message" : "messages"} that ${unused.length === 1 ? "is" : "are"} no comp's announcement?`)) remove(unused.map(r => r.messageId)) }}>
          <Trash2 size={14} /> Remove all not used ({unused.length})
        </Button>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {failure && <p role="alert" className="text-sm text-danger">{failure}</p>}
      {!error && rows.length === 0 && <p className="text-sm text-fg-muted">Nothing is tracked yet.</p>}
      <ul className="divide-y divide-line/60">
        {rows.map(row => (
          <li key={row.messageId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <div className="min-w-0 flex-1 basis-64 space-y-0.5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg">
                {row.usedBy && <Badge>{row.usedBy}</Badge>}
                {row.preview
                  ? <span className="min-w-0 break-words">
                      {row.preview.channelName && <span className="text-fg-muted">#{row.preview.channelName} · </span>}
                      <span className="font-medium">{row.preview.author ?? "Unknown"}</span>
                      <span className="text-fg-muted"> · {formatTime(row.preview.postedAt)}</span>
                    </span>
                  : <span className="text-fg-muted">{row.preview === null ? "Not found on Discord any more" : "Message"}</span>}
                {row.link
                  ? <a href={row.link} target="_blank" rel="noreferrer" aria-label="Open on Discord" className="inline-flex items-center gap-1 font-mono text-xs text-fg-subtle hover:text-fg">{row.messageId} <ExternalLink size={12} /></a>
                  : <span className="font-mono text-xs text-fg-subtle">{row.messageId}</span>}
              </p>
              {(row.preview?.text || row.preview?.attachments) ? (
                <p className="line-clamp-2 break-words text-xs text-fg-soft">
                  {row.preview.text || ""}{row.preview.attachments > 0 && <span className="text-fg-muted"> {row.preview.text ? "· " : ""}{row.preview.attachments} {row.preview.attachments === 1 ? "attachment" : "attachments"}</span>}
                </p>
              ) : null}
              <p className="text-xs text-fg-muted">
                {row.reactions} {row.reactions === 1 ? "reaction" : "reactions"}
                {row.lastAt ? ` · last ${formatTime(row.lastAt)}` : " · no reactions yet"}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" disabled={busy} onClick={() => remove([row.messageId])} aria-label={`Remove message ${row.messageId}`}>
              <Trash2 size={14} /> Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
