"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Link2Off, UserX, Undo2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import { cn } from "@/lib/utils"
import type { PlayerStatus } from "@/lib/player-status"

interface Account {
  id: string
  name: string
  username: string
  directoryName?: string
  roles: string[]
  onServer: boolean
  playerId: string | null
  notAPlayer: boolean
  suggestion: string | null
}
interface Player { id: string; name: string; status: PlayerStatus; discordUserId: string | null }

type Tab = "open" | "linked" | "ignored"

export function DiscordAccountsView({ accounts, players, error }: { accounts: Account[]; players: Player[]; error: string | null }) {
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")
  const byId = new Map(players.map(p => [p.id, p]))
  const visible = accounts.filter(a => showAll || a.roles.length > 0 || a.playerId || !a.onServer)
  const groups = {
    open: visible.filter(a => !a.playerId && !a.notAPlayer),
    linked: visible.filter(a => a.playerId),
    ignored: visible.filter(a => a.notAPlayer),
  }
  const [tab, setTab] = useState<Tab>(groups.open.length > 0 ? "open" : "linked")
  const choice = (a: Account) => choices[a.id] ?? a.suggestion ?? ""
  const suggested = groups.open.filter(a => a.suggestion && !choices[a.id])
  const withoutAccount = players.filter(p => !p.discordUserId && (p.status === "MEMBER" || p.status === "TRIAL"))

  async function send(body: unknown) {
    setBusy(true); setFailure("")
    const response = await fetch(`${BASE_PATH}/api/players/discord`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null)
    const data = await response?.json().catch(() => ({}))
    setBusy(false)
    if (!response?.ok) { setFailure(data?.error ?? "Could not save."); return }
    setChoices({})
    router.refresh()
  }
  const link = (links: Array<{ discordUserId: string; playerId: string }>) => send({ action: "link", links })

  return (
    <div className="space-y-6 page-wide">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/players" className="mb-1 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"><ArrowLeft size={14} /> Players</Link>
          <h1 className="text-2xl font-bold text-fg">Discord accounts</h1>
          <p className="mt-0.5 text-sm text-fg-muted">Link each account to its player once. Reaction imports then recognise it by its Discord ID, also after renames.</p>
        </div>
        {tab === "open" && suggested.length > 0 && (
          <Button disabled={busy} onClick={() => link(suggested.map(a => ({ discordUserId: a.id, playerId: a.suggestion! })))}>
            <Check size={15} /> Confirm all suggestions ({suggested.length})
          </Button>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error} Existing links are kept.</p>}
      {failure && <p role="alert" className="text-sm text-danger">{failure}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full flex-wrap rounded-lg border border-line p-1" role="tablist">
          {([["open", "To link"], ["linked", "Linked"], ["ignored", "Not a player"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
              className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors max-md:px-3",
                tab === value ? "bg-brand/15 text-brand-ink" : "text-fg-muted hover:text-fg")}>
              {label}
              <span className={cn("text-xs", tab === value ? "text-brand-ink/70" : "text-fg-subtle")}>{groups[value].length}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-fg-soft">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Show all server members
        </label>
      </div>

      <div className="space-y-2">
        {groups[tab].length === 0 && <p className="text-sm text-fg-muted">{tab === "open" ? "Every account with a team role is linked or marked." : "No accounts here."}</p>}
        {groups[tab].map(a => {
          const chosen = choice(a)
          const replaces = chosen && byId.get(chosen)?.discordUserId && byId.get(chosen)?.discordUserId !== a.id ? byId.get(chosen) : null
          return (
            <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  <span className="truncate" title={`Discord ID: ${a.id}`}>{a.onServer ? a.name : "Left the server"}</span>
                  {a.roles.map(r => <Badge key={r}>{r}</Badge>)}
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {a.username && `@${a.username}`}{a.directoryName && a.directoryName !== a.name && ` · team list: ${a.directoryName}`}
                  {tab === "linked" && a.playerId && <> · <span className="text-fg-soft">{byId.get(a.playerId)?.name}</span></>}
                </p>
              </div>
              {tab === "open" && <>
                <div className="min-w-0 md:w-64">
                  <Select aria-label={`Player for ${a.name}`} value={chosen} disabled={busy} onChange={e => setChoices(old => ({ ...old, [a.id]: e.target.value }))}>
                    <option value="">Choose player…</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}{p.discordUserId ? " (has an account)" : ""}</option>)}
                  </Select>
                  {chosen && chosen === a.suggestion && !choices[a.id] && <p className="mt-1 text-xs text-fg-subtle">Suggested by name</p>}
                  {replaces && <p className="mt-1 text-xs text-danger">Replaces {replaces.name}&apos;s current account</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || !chosen} onClick={() => link([{ discordUserId: a.id, playerId: chosen }])}><Check size={14} /> Link</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => send({ action: "not-a-player", discordUserId: a.id, value: true })}><UserX size={14} /> Not a player</Button>
                </div>
              </>}
              {tab === "linked" && <Button size="sm" variant="outline" disabled={busy} onClick={() => send({ action: "unlink", discordUserId: a.id })}><Link2Off size={14} /> Unlink</Button>}
              {tab === "ignored" && <Button size="sm" variant="outline" disabled={busy} onClick={() => send({ action: "not-a-player", discordUserId: a.id, value: false })}><Undo2 size={14} /> Take back</Button>}
            </div>
          )
        })}
      </div>

      {withoutAccount.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Members and trials without a Discord account ({withoutAccount.length})</h2>
          <p className="text-sm text-fg-muted">{withoutAccount.map(p => p.name).join(", ")}</p>
        </section>
      )}
    </div>
  )
}
