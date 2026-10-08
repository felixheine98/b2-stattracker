"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSyncedState } from "@/lib/use-synced-state"
import { PlayerAvatar } from "@/components/player-avatar"
import { countryName, countryOptions } from "@/lib/countries"
import {
  currentStatus,
  dayKey,
  formatDay,
  sortedChanges,
  localTodayKey,
  statusAt,
  tournamentReferenceDate,
  type PlayerStatus,
  type StatusChange,
} from "@/lib/player-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ArrowLeftRight, Check, History, KeyRound, Link2, Link2Off, Plus, RefreshCw, Search, Trash2, Trophy, User, Wand2, X } from "lucide-react"

interface UserOption {
  id: string
  name: string
  username: string
  playerId: string | null
}

interface Player {
  id: string
  tmId: string
  name: string
  country?: string | null
  createdAt: Date
  // Result of the last comparison with trackmania.io and the values the user chose to ignore
  tmioName?: string | null
  tmioCountry?: string | null
  tmioCheckedAt?: Date | string | null
  dismissedTmioName?: string | null
  dismissedTmioCountry?: string | null
  initialStatus: PlayerStatus
  statusChanges: StatusChange[]
  tournamentLineupSlots?: Array<{
    lineup: {
      name: string
      tournament: { id: string; name: string; startDate: Date | null; createdAt: Date }
    }
  }>
  user?: { id: string; name: string; email: string | null; username: string } | null
  _count?: { roundResults: number }
}

// A player found on trackmania.io
interface TmioResult {
  id: string
  name: string
  clubTag: string | null
  country: string | null
  countryName: string | null
  region: string | null
  existing: { name: string; status: PlayerStatus } | null
}

type Tab = "members" | "guests"

// trackmania.io allows 40 requests per minute
const SYNC_DELAY_MS = 1600

// A differing trackmania.io value that has not been taken over or hidden yet
function nameHint(player: Player): string | null {
  const value = player.tmioName
  return value && value !== player.name && value !== player.dismissedTmioName ? value : null
}

function countryHint(player: Player): string | null {
  const value = player.tmioCountry
  return value && player.country && value !== player.country && value !== player.dismissedTmioCountry ? value : null
}

interface Props {
  players: Player[]
  users: UserOption[]
  canManage: boolean
}

const STATUS_LABEL: Record<PlayerStatus, string> = { MEMBER: "Member", GUEST: "Guest" }

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return dayKey(date)
}

// "Guest since 01.10.2026" or "Member from the start"
function statusSummary(player: Player): string {
  const last = sortedChanges(player).at(-1)
  return last
    ? `${STATUS_LABEL[last.status]} since ${formatDay(last.effectiveFrom)}`
    : `${STATUS_LABEL[player.initialStatus]} from the start`
}

// A trackmania.io value that differs from ours, with the two ways to settle it
function HintLine({ label, canManage, onAdopt, onDismiss }: { label: string; canManage: boolean; onAdopt: () => void; onDismiss: () => void }) {
  return (
    <p className="mt-1 flex items-center gap-2 whitespace-nowrap text-[11px] font-normal text-[#cd7f32]">
      {label}
      {canManage && (
        <>
          <button type="button" onClick={onAdopt} className="text-[#FBD00D] hover:underline">Adopt</button>
          <button type="button" onClick={onDismiss} className="text-[#9a9090] hover:underline">Hide</button>
        </>
      )}
    </p>
  )
}

export function PlayersView({ players: initial, users, canManage }: Props) {
  const router = useRouter()
  const [players, setPlayers] = useSyncedState(initial)
  // The tab lives in the address, so a reload or shared link opens the same tab
  const tab: Tab = useSearchParams().get("tab") === "guests" ? "guests" : "members"
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [autoLinking, startAutoLink] = useTransition()

  // --- Add dialog: trackmania.io search ---
  const [formName, setFormName] = useState("")
  const [formTmId, setFormTmId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TmioResult[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [picked, setPicked] = useState<TmioResult | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latestQuery = useRef("")

  // --- Comparison with trackmania.io ---
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null)
  const [syncMessage, setSyncMessage] = useState("")
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const cancelSync = useRef(false)

  // Leaving the page stops a running comparison and any pending search
  useEffect(() => {
    return () => {
      cancelSync.current = true
      clearTimeout(searchTimer.current)
    }
  }, [])

  // --- Move between members and guests ---
  const [moveId, setMoveId] = useState<string | null>(null)
  const [moveDate, setMoveDate] = useState("")
  const [moveError, setMoveError] = useState("")
  const [moveLoading, setMoveLoading] = useState(false)

  // --- Status history ---
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [historyDates, setHistoryDates] = useState<Record<string, string>>({})
  const [historyError, setHistoryError] = useState("")
  const [historyLoading, setHistoryLoading] = useState(false)

  // Which accounts are taken follows the local player list, so links made here apply at once
  const linkedUserIds = new Set(players.flatMap((p) => (p.user ? [p.user.id] : [])))
  const members = players.filter((p) => currentStatus(p) === "MEMBER")
  const guests = players.filter((p) => currentStatus(p) === "GUEST")
  const visible = tab === "members" ? members : guests
  const newStatus: PlayerStatus = tab === "members" ? "MEMBER" : "GUEST"
  const movePlayer = players.find((p) => p.id === moveId)
  const historyPlayer = players.find((p) => p.id === historyId)

  function selectTab(next: Tab) {
    window.history.replaceState(null, "", next === "guests" ? "?tab=guests" : window.location.pathname)
  }

  function replaceStatusChanges(playerId: string, statusChanges: StatusChange[]) {
    setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, statusChanges } : pl)))
  }

  // Drop a pending or running search so its answer cannot show up later
  function resetSearch() {
    clearTimeout(searchTimer.current)
    latestQuery.current = ""
    setSearchLoading(false)
  }

  function closeForm() {
    resetSearch()
    setShowForm(false)
  }

  function openForm() {
    resetSearch()
    setShowForm(true)
    setError("")
    setFormName("")
    setFormTmId("")
    setSearchQuery("")
    setSearchResults(null)
    setSearchError("")
    setPicked(null)
  }

  async function runSearch(query: string) {
    setSearchLoading(true)
    setSearchError("")
    const res = await fetch(`/b2-stats/api/tmio/search?q=${encodeURIComponent(query)}`).catch(() => null)
    // Ignore answers that were overtaken by a newer search
    if (latestQuery.current !== query) return
    setSearchLoading(false)
    const data = await res?.json().catch(() => null)
    if (!res?.ok || !Array.isArray(data?.results)) {
      setSearchResults(null)
      setSearchError(data?.error ?? "Search failed")
      return
    }
    setSearchResults(data.results)
  }

  // Search a moment after typing stops, to stay well within trackmania.io's request limit
  function handleSearchChange(value: string) {
    setSearchQuery(value)
    latestQuery.current = value.trim()
    clearTimeout(searchTimer.current)
    if (value.trim().length < 3) {
      setSearchResults(null)
      setSearchError("")
      setSearchLoading(false)
      return
    }
    searchTimer.current = setTimeout(() => runSearch(value.trim()), 500)
  }

  function pickResult(result: TmioResult) {
    setPicked(result)
    setFormName(result.name)
    setFormTmId(result.id)
    setError("")
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await fetch("/b2-stats/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName.trim(),
        tmId: formTmId.trim().toLowerCase(),
        status: newStatus,
        ...(picked && { country: picked.country, tmio: { name: picked.name, country: picked.country } }),
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "Failed to create player")
      return
    }
    const data = await res.json()
    setPlayers((p) => [...p, { ...data, user: null, _count: { roundResults: 0 } }].sort((a, b) => a.name.localeCompare(b.name)))
    closeForm()
  }

  // Compare one player with trackmania.io; resolves to what happened
  async function syncPlayer(player: Player): Promise<"ok" | "difference" | "notfound" | "gone" | "limit" | "error"> {
    const res = await fetch(`/b2-stats/api/players/${player.id}/tmio`, { method: "POST" }).catch(() => null)
    // 404 means the player was deleted here in the meantime
    if (!res?.ok) return res?.status === 429 ? "limit" : res?.status === 404 ? "gone" : "error"
    const data = await res.json()
    const merged = { ...player, ...data }
    setPlayers((p) => p.map((pl) => (pl.id === player.id ? { ...pl, ...data } : pl)))
    if (!data.tmioName) return "notfound"
    return nameHint(merged) || countryHint(merged) ? "difference" : "ok"
  }

  async function handleSyncOne(player: Player) {
    setSyncingId(player.id)
    setSyncMessage("")
    const outcome = await syncPlayer(player)
    setSyncingId(null)
    if (outcome === "limit") setSyncMessage("trackmania.io request limit reached, try again in a minute.")
    else if (outcome === "error") setSyncMessage(`Could not check ${player.name} on trackmania.io.`)
    else if (outcome === "notfound") setSyncMessage(`${player.name} was not found on trackmania.io.`)
    else if (outcome === "difference") setSyncMessage(`${player.name} checked: differs from trackmania.io, see the hint in the row.`)
    else if (outcome === "ok") setSyncMessage(`${player.name} checked: no differences.`)
  }

  async function handleSyncAll() {
    const list = visible
    cancelSync.current = false
    setSyncMessage("")
    setSyncProgress({ done: 0, total: list.length })
    const counts = { ok: 0, difference: 0, notfound: 0, gone: 0, error: 0 }
    let stopped = ""
    for (const [i, player] of list.entries()) {
      if (cancelSync.current) { stopped = " Stopped early."; break }
      const outcome = await syncPlayer(player)
      if (outcome === "limit") { stopped = " Stopped: trackmania.io request limit reached, try again in a minute."; break }
      counts[outcome]++
      setSyncProgress({ done: i + 1, total: list.length })
      if (i < list.length - 1) await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS))
    }
    setSyncProgress(null)
    const checked = counts.ok + counts.difference + counts.notfound
    setSyncMessage(
      `${checked} of ${list.length - counts.gone} checked, ${counts.difference} with differences, ${counts.notfound} not found` +
        (counts.error > 0 ? `, ${counts.error} failed` : "") + "." + stopped
    )
  }

  async function resolveHint(player: Player, field: "name" | "country", action: "adopt" | "dismiss") {
    const res = await fetch(`/b2-stats/api/players/${player.id}/tmio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, action, value: field === "name" ? player.tmioName : player.tmioCountry }),
    })
    const body = await res.json().catch(() => null)
    // 409: the value changed since this page loaded; show the fresh hint instead of acting on it
    const data = res.ok ? body : res.status === 409 ? body?.player : null
    if (!data) return
    setPlayers((p) =>
      p.map((pl) => (pl.id === player.id ? { ...pl, ...data } : pl)).sort((a, b) => a.name.localeCompare(b.name))
    )
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this player?")) return
    setDeleting(id)
    await fetch(`/b2-stats/api/players/${id}`, { method: "DELETE" })
    setDeleting(null)
    setPlayers((p) => p.filter((pl) => pl.id !== id))
  }

  async function handleCountry(playerId: string, country: string | null) {
    const res = await fetch(`/b2-stats/api/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    })
    if (!res.ok) return
    setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, country } : pl)))
  }

  async function handleLink(playerId: string, userId: string | null) {
    setLinking(playerId)
    const res = await fetch(`/b2-stats/api/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    setLinking(null)
    if (!res.ok) return
    const data = await res.json()
    setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, user: data.user } : pl)))
  }

  // Accounts are only linked to team members, never to guests
  function autoLinkMatch(player: Player) {
    if (player.user) return undefined
    return users.find(
      (u) =>
        !linkedUserIds.has(u.id) &&
        (u.name.toLowerCase().trim() === player.name.toLowerCase().trim() ||
          u.username.toLowerCase().trim() === player.name.toLowerCase().trim())
    )
  }

  function handleAutoLink() {
    startAutoLink(async () => {
      for (const player of members) {
        const match = autoLinkMatch(player)
        if (match) await handleLink(player.id, match.id)
      }
      router.refresh()
    })
  }

  // Show unlinked users plus whoever is already linked to this player
  function availableUsers(player: Player) {
    return users.filter((u) => !linkedUserIds.has(u.id) || u.id === player.user?.id)
  }

  const autoLinkCount = members.filter((p) => autoLinkMatch(p)).length

  function openMove(player: Player) {
    setMoveId(player.id)
    setMoveDate(localTodayKey())
    setMoveError("")
  }

  async function handleMove() {
    if (!movePlayer) return
    setMoveError("")
    setMoveLoading(true)
    const res = await fetch(`/b2-stats/api/players/${movePlayer.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: currentStatus(movePlayer) === "MEMBER" ? "GUEST" : "MEMBER",
        effectiveFrom: moveDate,
      }),
    })
    setMoveLoading(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setMoveError(data?.error ?? "Failed to move player")
      return
    }
    replaceStatusChanges(movePlayer.id, data.statusChanges)
    setMoveId(null)
  }

  function openHistory(player: Player) {
    setHistoryId(player.id)
    setHistoryDates({})
    setHistoryError("")
  }

  async function saveHistoryDate(change: StatusChange) {
    if (!historyPlayer) return
    setHistoryError("")
    setHistoryLoading(true)
    const res = await fetch(`/b2-stats/api/players/${historyPlayer.id}/status/${change.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effectiveFrom: historyDates[change.id] }),
    })
    setHistoryLoading(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setHistoryError(data?.error ?? "Failed to save")
      return
    }
    replaceStatusChanges(historyPlayer.id, data.statusChanges)
    setHistoryDates({})
  }

  async function deleteHistoryChange(change: StatusChange) {
    if (!historyPlayer) return
    if (!confirm("Remove this switch?")) return
    setHistoryError("")
    setHistoryLoading(true)
    const res = await fetch(`/b2-stats/api/players/${historyPlayer.id}/status/${change.id}`, { method: "DELETE" })
    setHistoryLoading(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setHistoryError(data?.error ?? "Failed to remove")
      return
    }
    replaceStatusChanges(historyPlayer.id, data.statusChanges)
  }

  const moveTarget: PlayerStatus | null = movePlayer ? (currentStatus(movePlayer) === "MEMBER" ? "GUEST" : "MEMBER") : null
  const moveLastChange = movePlayer ? sortedChanges(movePlayer).at(-1) : undefined
  const moveMinDate = moveLastChange ? nextDay(dayKey(moveLastChange.effectiveFrom)) : undefined

  // Switches and tournaments in one timeline; on the same day the switch comes first
  const timeline = historyPlayer
    ? [
        ...sortedChanges(historyPlayer).map((change) => ({ kind: "change" as const, day: dayKey(change.effectiveFrom), change })),
        ...(historyPlayer.tournamentLineupSlots ?? []).map((slot) => {
          const day = dayKey(tournamentReferenceDate(slot.lineup.tournament))
          return { kind: "tournament" as const, day, slot, status: statusAt(historyPlayer, day) }
        }),
      ].sort((a, b) => a.day.localeCompare(b.day) || (a.kind === b.kind ? 0 : a.kind === "change" ? -1 : 1))
    : []
  const historyChanges = historyPlayer ? sortedChanges(historyPlayer) : []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0f0]">Players</h1>
          <p className="text-[#9a9090] text-sm mt-0.5">
            {members.length} team member{members.length !== 1 ? "s" : ""}, {guests.length} guest{guests.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && tab === "members" && autoLinkCount > 0 && (
            <Button variant="outline" onClick={handleAutoLink} disabled={autoLinking}>
              <Wand2 size={15} />
              Auto-link ({autoLinkCount})
            </Button>
          )}
          {canManage && (syncProgress || visible.length > 0) && (
            syncProgress ? (
              <Button variant="outline" onClick={() => { cancelSync.current = true }}>
                <RefreshCw size={15} className="animate-spin" />
                {syncProgress.done}/{syncProgress.total} · Stop
              </Button>
            ) : (
              <Button variant="outline" onClick={handleSyncAll} disabled={!!syncingId} title="Compare names and countries with trackmania.io">
                <RefreshCw size={15} />
                Sync with trackmania.io
              </Button>
            )
          )}
          {canManage && (
            <Button onClick={openForm}>
              <Plus size={16} />
              {tab === "members" ? "Add Member" : "Add Guest"}
            </Button>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-[#2d2829] p-1" role="tablist">
        {([
          ["members", "Members", members.length],
          ["guests", "Guests", guests.length],
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === value ? "bg-[#FBD00D]/15 text-[#FBD00D]" : "text-[#9a9090] hover:text-[#f5f0f0]"
            )}
          >
            {label}
            <span className={cn("text-xs", tab === value ? "text-[#FBD00D]/70" : "text-[#5e5858]")}>{count}</span>
          </button>
        ))}
      </div>

      {syncMessage && (
        <p className="flex items-center justify-between gap-3 rounded-lg border border-[#2d2829] bg-[#1c1819] px-4 py-2 text-sm text-[#c5bfbf]">
          {syncMessage}
          <button type="button" onClick={() => setSyncMessage("")} className="text-[#5e5858] hover:text-[#f5f0f0]" title="Close">
            <X size={14} />
          </button>
        </p>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User size={32} className="mx-auto text-[#5e5858] mb-3" />
            <p className="text-[#9a9090] text-sm">
              {tab === "members"
                ? "No team members yet. Add your first teammate."
                : "No guests yet. Guests are stand-in players who drive in your lineups without being part of the team."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-[#2d2829] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2d2829] bg-[#251f20]">
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Land</th>
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">TM ID</th>
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">{tab === "members" ? "Linked account" : "Login"}</th>
                <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Status</th>
                <th className="text-right px-4 py-3 text-[#9a9090] font-medium">Results</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((player, i) => (
                <tr
                  key={player.id}
                  className={`border-b border-[#2d2829] last:border-0 ${i % 2 === 0 ? "bg-[#1c1819]" : "bg-[#1c1819]/60"}`}
                >
                  <td className="px-4 py-3 font-medium text-[#f5f0f0]">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <PlayerAvatar player={player} />
                      {player.name}
                    </span>
                    {nameHint(player) && (
                      <HintLine label={`trackmania.io: ${nameHint(player)}`} canManage={canManage}
                        onAdopt={() => resolveHint(player, "name", "adopt")}
                        onDismiss={() => resolveHint(player, "name", "dismiss")} />
                    )}
                    {player.tmioCheckedAt && !player.tmioName && (
                      <p className="mt-1 text-[11px] font-normal text-[#cd7f32]">not found on trackmania.io</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={player.country ?? ""}
                        onChange={(e) => handleCountry(player.id, e.target.value || null)}
                        aria-label={`Land von ${player.name}`}
                        className="h-8 w-32 rounded-md border border-[#3a3435] bg-[#251f20] px-2 text-xs text-[#f5f0f0] focus:outline-none focus:ring-2 focus:ring-[#FBD00D]"
                      >
                        <option value="">— kein Land —</option>
                        {countryOptions(player.country).map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-[#9a9090]">{player.country ? countryName(player.country) : "—"}</span>
                    )}
                    {countryHint(player) && (
                      <HintLine label={`trackmania.io: ${countryName(countryHint(player)!)}`} canManage={canManage}
                        onAdopt={() => resolveHint(player, "country", "adopt")}
                        onDismiss={() => resolveHint(player, "country", "dismiss")} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#5e5858]">{player.tmId}</td>
                  <td className="px-4 py-3">
                    {tab === "guests" ? (
                      // Guests keep a login they had as a member; a new one cannot be linked
                      player.user ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#cd7f32]">
                            <KeyRound size={12} />
                            {player.user.username}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => handleLink(player.id, null)}
                              disabled={linking === player.id}
                              className="text-[#5e5858] hover:text-[#ED1F24] disabled:opacity-40"
                              title="Unlink"
                            >
                              <Link2Off size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#3a3435]">—</span>
                      )
                    ) : canManage ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={player.user?.id ?? ""}
                          onChange={(e) => handleLink(player.id, e.target.value || null)}
                          disabled={linking === player.id}
                          className="h-7 rounded border border-[#3a3435] bg-[#251f20] px-2 text-xs text-[#f5f0f0] focus:outline-none focus:ring-1 focus:ring-[#FBD00D] disabled:opacity-50"
                        >
                          <option value="">— no account —</option>
                          {availableUsers(player).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.username})
                            </option>
                          ))}
                        </select>
                        {player.user && (
                          <button
                            onClick={() => handleLink(player.id, null)}
                            disabled={linking === player.id}
                            className="text-[#5e5858] hover:text-[#ED1F24] disabled:opacity-40"
                            title="Unlink"
                          >
                            <Link2Off size={13} />
                          </button>
                        )}
                        {!player.user && linking !== player.id && (
                          <Link2 size={13} className="text-[#3a3435]" />
                        )}
                      </div>
                    ) : (
                      <span className="text-[#9a9090]">
                        {player.user?.name ?? <span className="text-[#3a3435]">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openHistory(player)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-[#9a9090] hover:text-[#f5f0f0]"
                      title="Show history"
                    >
                      <History size={12} />
                      {statusSummary(player)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right text-[#9a9090]">{player._count?.roundResults ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncOne(player)}
                          disabled={!!syncProgress || !!syncingId}
                          className="text-[#5e5858] hover:text-[#f5f0f0]"
                          title="Compare with trackmania.io"
                        >
                          <RefreshCw size={14} className={syncingId === player.id ? "animate-spin" : ""} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openMove(player)} className="whitespace-nowrap">
                          <ArrowLeftRight size={13} />
                          {tab === "members" ? "To guests" : "To members"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(player.id)}
                          disabled={deleting === player.id}
                          className="text-[#5e5858] hover:text-[#ED1F24]"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add member / guest */}
      <Dialog open={canManage && showForm} onClose={closeForm} className="max-w-lg">
        <DialogTitle>{tab === "members" ? "Add Member" : "Add Guest"}</DialogTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tmio-search">Find on trackmania.io</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e5858]" />
              <Input
                id="tmio-search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
                placeholder="Name, player ID or trackmania.io link"
                autoComplete="off"
                className="pl-9"
              />
            </div>
            {searchLoading && <p className="text-xs text-[#5e5858]">Searching…</p>}
            {searchError && <p className="text-xs text-[#ED1F24]">{searchError}</p>}
            {searchResults && searchResults.length === 0 && !searchLoading && (
              <p className="text-xs text-[#5e5858]">No player found. You can still enter name and ID below.</p>
            )}
            {searchResults && searchResults.length > 0 && (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-[#2d2829] bg-[#0e0c0d] p-1.5">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => pickResult(result)}
                    disabled={!!result.existing}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-50",
                      picked?.id === result.id
                        ? "border-[#FBD00D]/50 bg-[#FBD00D]/10"
                        : "border-transparent hover:bg-[#251f20]"
                    )}
                  >
                    <PlayerAvatar player={result} className="h-5 w-5 text-[10px]" />
                    <span className="font-medium text-[#f5f0f0]">{result.name}</span>
                    {result.clubTag && <span className="rounded bg-[#251f20] px-1.5 text-[10px] text-[#9a9090]">{result.clubTag}</span>}
                    <span className="ml-auto truncate text-xs text-[#5e5858]">
                      {result.existing
                        ? `already added as ${STATUS_LABEL[result.existing.status].toLowerCase()}`
                        : [result.region, result.countryName].filter(Boolean).join(", ")}
                    </span>
                    {picked?.id === result.id && <Check size={14} className="shrink-0 text-[#FBD00D]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Tommy.TM" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmId">Trackmania Player ID</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tmId"
                value={formTmId}
                onChange={(e) => setFormTmId(e.target.value)}
                readOnly={!!picked}
                placeholder="15b02a29-73f5-459d-a46e-4a28b1941c34"
                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                required
                className={cn("font-mono text-xs", picked && "opacity-70")}
              />
              {picked && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPicked(null); setFormTmId("") }} title="Enter the ID by hand instead">
                  <X size={14} />
                </Button>
              )}
            </div>
            <p className="text-xs text-[#5e5858]">
              {picked
                ? `Taken from trackmania.io${picked.country ? `, country ${countryName(picked.country)}` : ""}.`
                : "Filled in when you pick a search result, or paste the UUID by hand."}
            </p>
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : tab === "members" ? "Add Member" : "Add Guest"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Move between members and guests */}
      <Dialog open={canManage && !!movePlayer} onClose={() => setMoveId(null)}>
        <DialogTitle>
          Move {movePlayer?.name} to {moveTarget === "GUEST" ? "guests" : "members"}?
        </DialogTitle>
        <div className="space-y-4">
          <p className="text-sm text-[#9a9090]">
            Lineups, results and the flag stay as they are. Tournaments that started before the chosen day keep showing{" "}
            {movePlayer?.name} as {moveTarget === "GUEST" ? "member" : "guest"}.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="move-date">Effective from</Label>
            <Input
              id="move-date"
              type="date"
              value={moveDate}
              min={moveMinDate}
              max={localTodayKey()}
              onChange={(e) => setMoveDate(e.target.value)}
              required
            />
            {moveLastChange && (
              <p className="text-xs text-[#5e5858]">
                Must be after the previous switch on {formatDay(moveLastChange.effectiveFrom)}.
              </p>
            )}
          </div>
          {movePlayer?.user && moveTarget === "GUEST" && (
            <p className="flex items-start gap-2 rounded-lg border border-[#cd7f32]/40 bg-[#cd7f32]/10 px-3 py-2 text-xs text-[#cd7f32]">
              <KeyRound size={14} className="mt-0.5 shrink-0" />
              The login “{movePlayer.user.username}” stays active. Delete it on the Accounts page if this person should no longer have access.
            </p>
          )}
          {moveError && <p className="text-sm text-[#ED1F24]">{moveError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setMoveId(null)}>Cancel</Button>
            <Button onClick={handleMove} disabled={moveLoading || !moveDate}>
              {moveLoading ? "Moving…" : moveTarget === "GUEST" ? "Move to guests" : "Move to members"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Status history */}
      <Dialog open={!!historyPlayer} onClose={() => setHistoryId(null)} className="max-w-lg">
        <DialogTitle>History of {historyPlayer?.name}</DialogTitle>
        {historyPlayer && (
          <div className="space-y-4">
            <ol className="space-y-2">
              <li className="flex items-center gap-3 rounded-lg border border-[#2d2829] px-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-[#5e5858]">from the start</span>
                <span className="font-medium text-[#f5f0f0]">{STATUS_LABEL[historyPlayer.initialStatus]}</span>
              </li>
              {timeline.map((entry) =>
                entry.kind === "change" ? (
                  <li key={entry.change.id} className="flex items-center gap-3 rounded-lg border border-[#FBD00D]/30 bg-[#FBD00D]/5 px-3 py-2 text-sm">
                    {canManage ? (
                      <Input
                        type="date"
                        value={historyDates[entry.change.id] ?? entry.day}
                        max={localTodayKey()}
                        onChange={(e) => setHistoryDates((d) => ({ ...d, [entry.change.id]: e.target.value }))}
                        aria-label="Effective from"
                        className="h-8 w-36 shrink-0 text-xs"
                      />
                    ) : (
                      <span className="w-24 shrink-0 text-xs text-[#9a9090]">{formatDay(entry.day)}</span>
                    )}
                    <span className="flex-1 font-medium text-[#f5f0f0]">Switch to {STATUS_LABEL[entry.change.status].toLowerCase()}</span>
                    {canManage && historyDates[entry.change.id] && historyDates[entry.change.id] !== entry.day && (
                      <Button size="sm" onClick={() => saveHistoryDate(entry.change)} disabled={historyLoading}>Save</Button>
                    )}
                    {canManage && entry.change.id === historyChanges.at(-1)?.id && (
                      <button
                        type="button"
                        onClick={() => deleteHistoryChange(entry.change)}
                        disabled={historyLoading}
                        className="text-[#5e5858] hover:text-[#ED1F24] disabled:opacity-40"
                        title="Remove this switch"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ) : (
                  <li key={`${entry.slot.lineup.tournament.id}-${entry.slot.lineup.name}`} className="flex items-center gap-3 px-3 py-1 text-sm">
                    <span className="w-24 shrink-0 text-xs text-[#5e5858]">{formatDay(entry.day)}</span>
                    <Trophy size={13} className="shrink-0 text-[#5e5858]" />
                    <span className="flex-1 text-[#c5bfbf]">
                      {entry.slot.lineup.tournament.name}
                      <span className="text-[#5e5858]"> · {entry.slot.lineup.name}</span>
                    </span>
                    <span className={cn("text-xs", entry.status === "GUEST" ? "text-[#cd7f32]" : "text-[#9a9090]")}>
                      as {STATUS_LABEL[entry.status].toLowerCase()}
                    </span>
                  </li>
                )
              )}
            </ol>
            {timeline.length === 0 && (
              <p className="text-xs text-[#5e5858]">No switches and no tournaments yet.</p>
            )}
            {historyError && <p className="text-sm text-[#ED1F24]">{historyError}</p>}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setHistoryId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
