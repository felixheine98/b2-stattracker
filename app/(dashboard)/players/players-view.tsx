"use client"

import { BASE_PATH } from "@/lib/base-path"
import { allNames, shownName, type NameChange } from "@/lib/player-names"
import { NameHistoryDialog } from "./name-history-dialog"
import { STATUS_LABEL, StatusHistoryDialog, StatusMoveDialog, statusSummary } from "./status-dialogs"
import { Fragment, useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { playerPath } from "@/lib/paths"
import { useSyncedState } from "@/lib/use-synced-state"
import { PlayerAvatar } from "@/components/player-avatar"
import { CountryFlagPicker } from "@/components/country-flag-picker"
import { countryName } from "@/lib/countries"
import { currentStatus, localTodayKey, mayGetLogin, type PlayerStatus, type StatusChange } from "@/lib/player-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ArrowLeftRight, Check, MessageCircle, History, KeyRound, Link2, Link2Off, Pencil, Plus, RefreshCw, Search, Trash2, User, Wand2, X } from "lucide-react"
import { searchPlayers } from "@/lib/player-search"
import { useOwnRow } from "@/components/own-player"
import { canManage as canManageRole } from "@/lib/roles"

interface UserOption {
  id: string
  name: string
  username: string
  playerId: string | null
}

interface Player {
  id: string
  slug?: string | null
  tmId: string
  name: string
  // What the team calls the player, shown instead of the gamertag (docs/adr/009-spitznamen.md)
  nickname?: string | null
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
  initialName: string
  nameChanges: NameChange[]
  tournamentLineupSlots?: Array<{
    lineup: {
      name: string
      tournament: { id: string; name: string; startDate: Date | null; createdAt: Date }
    }
  }>
  user?: { id: string; name: string; email: string | null; username: string; role?: string } | null
  // Tournaments with at least one round driven for us
  tournamentsPlayed?: number
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

type Tab = "members" | "trial" | "guests" | "former"

const TAB_STATUS: Record<Tab, PlayerStatus> = { members: "MEMBER", trial: "TRIAL", guests: "GUEST", former: "FORMER" }

// Search text for a player whose name differs on trackmania.io: the longest part of the name,
// without separators, digits and a "TM" prefix or suffix (NismoTM -> Nismo)
function searchKeyword(name: string): string {
  const parts = name
    .split(/[^\p{L}]+/u)
    .map((part) => part.replace(/^tm(?=.{3})|(?<=.{3})tm$/i, ""))
    .filter((part) => part.length >= 3)
  return parts.sort((x, y) => y.length - x.length)[0] ?? name.trim()
}

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

// A trackmania.io value that differs from ours, with the two ways to settle it
function HintLine({ label, canManage, onAdopt, onDismiss }: { label: string; canManage: boolean; onAdopt: () => void; onDismiss: () => void }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-normal text-bronze">
      {label}
      {canManage && (
        <>
          <button type="button" onClick={onAdopt} className="text-brand-ink hover:underline">Adopt</button>
          <button type="button" onClick={onDismiss} className="text-fg-muted hover:underline">Hide</button>
        </>
      )}
    </p>
  )
}

export function PlayersView({ players: initial, users, canManage }: Props) {
  const ownRow = useOwnRow()
  const router = useRouter()
  const [players, setPlayers] = useSyncedState(initial)
  // The tab lives in the address, so a reload or shared link opens the same tab
  const tabParam = useSearchParams().get("tab")
  const tab: Tab = tabParam === "guests" || tabParam === "trial" || tabParam === "former" ? tabParam : "members"
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [autoLinking, startAutoLink] = useTransition()

  // --- Add dialog: trackmania.io search ---
  const [formName, setFormName] = useState("")
  const [formTmId, setFormTmId] = useState("")
  // Day the new member or trial player joined
  const [formSince, setFormSince] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TmioResult[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [picked, setPicked] = useState<TmioResult | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latestQuery = useRef("")

  // --- Find a player's trackmania.io account and correct the TM ID ---
  const [relinkId, setRelinkId] = useState<string | null>(null)
  const [relinkError, setRelinkError] = useState("")
  const [relinkLoading, setRelinkLoading] = useState(false)

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

  // --- Move between members and guests, status history ---
  const [moveId, setMoveId] = useState<string | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)

  // Which accounts are taken follows the local player list, so links made here apply at once
  const linkedUserIds = new Set(players.flatMap((p) => (p.user ? [p.user.id] : [])))
  // --- Quick search: narrows every tab to the players whose current or a former name fits ---
  const [filter, setFilter] = useState("")
  // Without a search in the order of the names shown, so a nickname stands where it is looked for
  const found = filter.trim()
    ? searchPlayers(players.map((p) => ({ ...p, allNames: allNames(p) })), filter)
    : [...players].sort((a, b) => shownName(a).localeCompare(shownName(b)))
  const members = found.filter((p) => currentStatus(p) === "MEMBER")
  const trials = found.filter((p) => currentStatus(p) === "TRIAL")
  const guests = found.filter((p) => currentStatus(p) === "GUEST")
  const formers = found.filter((p) => currentStatus(p) === "FORMER")
  // The team's managers stand apart at the top of the members
  // Managers are the members whose account is admin or manager
  const isManager = (p: Player) => canManageRole(p.user?.role)
  // Admins first, then the managers; each by name
  const managers = members.filter(isManager).sort((a, b) => Number(b.user?.role === "ADMIN") - Number(a.user?.role === "ADMIN"))
  const visible = { members: [...managers, ...members.filter((p) => !isManager(p))], trial: trials, guests, former: formers }[tab]
  const newStatus = TAB_STATUS[tab]
  const addLabel = `Add ${STATUS_LABEL[newStatus].toLowerCase()}`
  const movePlayer = players.find((p) => p.id === moveId)
  const historyPlayer = players.find((p) => p.id === historyId)
  // --- Name history / rename ---
  const [nameDialog, setNameDialog] = useState<{ playerId: string; suggestion?: string } | null>(null)
  const namePlayer = players.find((p) => p.id === nameDialog?.playerId)
  const relinkPlayer = players.find((p) => p.id === relinkId)

  function selectTab(next: Tab) {
    window.history.replaceState(null, "", next === "members" ? window.location.pathname : `?tab=${next}`)
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
    setFormSince(localTodayKey())
    setSearchQuery("")
    setSearchResults(null)
    setSearchError("")
    setPicked(null)
  }

  async function runSearch(query: string) {
    setSearchLoading(true)
    setSearchError("")
    const res = await fetch(`${BASE_PATH}/api/tmio/search?q=${encodeURIComponent(query)}`).catch(() => null)
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

  function openRelink(player: Player) {
    resetSearch()
    setRelinkId(player.id)
    setRelinkError("")
    setSearchResults(null)
    setSearchError("")
    setPicked(null)
    const keyword = searchKeyword(player.name)
    setSearchQuery(keyword)
    if (keyword.length >= 3) {
      latestQuery.current = keyword
      runSearch(keyword)
    }
  }

  function closeRelink() {
    resetSearch()
    setRelinkId(null)
  }

  async function handleRelink() {
    if (!relinkPlayer || !picked) return
    setRelinkError("")
    setRelinkLoading(true)
    const res = await fetch(`${BASE_PATH}/api/players/${relinkPlayer.id}/tmio`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmId: picked.id }),
    }).catch(() => null)
    setRelinkLoading(false)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) {
      setRelinkError(data?.error ?? "Failed to update the TM ID")
      return
    }
    setPlayers((p) => p.map((pl) => (pl.id === relinkPlayer.id ? { ...pl, ...data } : pl)))
    setSyncMessage(`${relinkPlayer.name} is now linked to ${data.tmioName} on trackmania.io.`)
    closeRelink()
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
    const res = await fetch(`${BASE_PATH}/api/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName.trim(),
        tmId: formTmId.trim().toLowerCase(),
        status: newStatus,
        ...(newStatus !== "GUEST" && formSince && { since: formSince }),
        ...(picked && { country: picked.country, tmio: { name: picked.name, country: picked.country } }),
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "Failed to create the player")
      return
    }
    const data = await res.json()
    setPlayers((p) => [...p, { ...data, user: null, tournamentsPlayed: 0 }].sort((a, b) => a.name.localeCompare(b.name)))
    closeForm()
  }

  // Search box and result list, shared by the add dialog and the TM ID correction
  function searchField(id: string, onPick: (result: TmioResult) => void, emptyText: string) {
    return (
      <>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <Input
            id={id}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
            placeholder="Name, player ID or trackmania.io link"
            autoComplete="off"
            className="pl-9"
          />
        </div>
        {searchLoading && <p className="text-xs text-fg-subtle">Searching…</p>}
        {searchError && <p className="text-xs text-danger">{searchError}</p>}
        {searchResults && searchResults.length === 0 && !searchLoading && (
          <p className="text-xs text-fg-subtle">{emptyText}</p>
        )}
        {searchResults && searchResults.length > 0 && (
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-line bg-canvas p-1.5">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onPick(result)}
                disabled={!!result.existing}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-50",
                  picked?.id === result.id
                    ? "border-brand/50 bg-brand/10"
                    : "border-transparent hover:bg-raised"
                )}
              >
                <PlayerAvatar player={result} className="h-5 w-5 text-[10px]" />
                <span className="font-medium text-fg">{result.name}</span>
                {result.clubTag && <span className="rounded bg-raised px-1.5 text-[10px] text-fg-muted">{result.clubTag}</span>}
                <span className="ml-auto truncate text-xs text-fg-subtle">
                  {result.existing
                    ? `already added (${STATUS_LABEL[result.existing.status].toLowerCase()})`
                    : [result.region, result.countryName].filter(Boolean).join(", ")}
                </span>
                {picked?.id === result.id && <Check size={14} className="shrink-0 text-brand-ink" />}
              </button>
            ))}
          </div>
        )}
      </>
    )
  }

  // Compare one player with trackmania.io; resolves to what happened
  async function syncPlayer(player: Player): Promise<"ok" | "difference" | "notfound" | "gone" | "limit" | "error"> {
    const res = await fetch(`${BASE_PATH}/api/players/${player.id}/tmio`, { method: "POST" }).catch(() => null)
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
    const res = await fetch(`${BASE_PATH}/api/players/${player.id}/tmio`, {
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
    await fetch(`${BASE_PATH}/api/players/${id}`, { method: "DELETE" })
    setDeleting(null)
    setPlayers((p) => p.filter((pl) => pl.id !== id))
  }

  async function handleCountry(playerId: string, country: string | null) {
    const res = await fetch(`${BASE_PATH}/api/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    })
    if (!res.ok) return
    setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, country } : pl)))
  }

  async function handleLink(playerId: string, userId: string | null) {
    setLinking(playerId)
    const res = await fetch(`${BASE_PATH}/api/players/${playerId}`, {
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

  // The username is only needed to tell apart accounts sharing a display name
  function userLabel(u: { name: string; username: string }) {
    const duplicate = users.filter((other) => other.name === u.name).length > 1
    return duplicate ? `${u.name} (${u.username})` : u.name
  }

  const autoLinkCount = members.filter((p) => autoLinkMatch(p)).length
  // The numbers in the heading count everyone, whatever is being searched
  const count = (status: PlayerStatus) => players.filter((p) => currentStatus(p) === status).length

  return (
    <div className="space-y-6 page-wide">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fg page-title">Players</h1>
          <p className="text-fg-muted text-sm mt-0.5">
            {count("MEMBER")} member{count("MEMBER") !== 1 ? "s" : ""}, {count("TRIAL")} on trial, {count("GUEST")} guest{count("GUEST") !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Link href="/players/discord" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-strong px-4 text-sm font-medium text-fg transition-colors hover:border-fg-subtle hover:bg-raised">
              <MessageCircle size={15} />
              Discord<span className="max-md:hidden"> accounts</span>
            </Link>
          )}
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
                Sync<span className="max-md:hidden"> with trackmania.io</span>
              </Button>
            )
          )}
          {canManage && tab !== "former" && (
            <Button onClick={openForm}>
              <Plus size={16} />
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex max-w-full flex-wrap rounded-lg border border-line p-1" role="tablist">
        {([
          ["members", "Members", members.length],
          ["trial", "Trial", trials.length],
          ["guests", "Guests", guests.length],
          ["former", "Former", formers.length],
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors max-md:px-3",
              tab === value ? "bg-brand/15 text-brand-ink" : "text-fg-muted hover:text-fg"
            )}
          >
            {label}
            <span className={cn("text-xs", tab === value ? "text-brand-ink/70" : "text-fg-subtle")}>{count}</span>
          </button>
        ))}
      </div>
      {/* Quick search over all tabs: the numbers on the tabs show where the hits are */}
      <div className="relative w-full sm:w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setFilter("") }}
          placeholder="Find a player"
          aria-label="Find a player"
          autoComplete="off"
          className="pl-9"
        />
      </div>
      </div>

      {syncMessage && (
        <p className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-fg-soft">
          {syncMessage}
          <button type="button" onClick={() => setSyncMessage("")} className="text-fg-subtle hover:text-fg" title="Close">
            <X size={14} />
          </button>
        </p>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User size={32} className="mx-auto text-fg-subtle mb-3" />
            <p className="text-fg-muted text-sm">
              {filter.trim()
                ? "No player in this tab matches the search. The numbers on the tabs show where the hits are."
                : tab === "members"
                ? "No members yet. Add the first one."
                : tab === "trial"
                ? "Nobody on trial. Players on trial are planned like members until they join for good."
                : tab === "guests"
                ? "No guests yet. Guests stand in for your lineups without being part of the team."
                : "No former players. This lists who no longer drives for the team; profile and results are kept."}
            </p>
          </CardContent>
        </Card>
      ) : (
        // The cells size themselves by the width of this box (@5xl / @7xl), so the table fits without scrolling
        <div className="@container rounded-xl border border-line overflow-x-auto max-md:overflow-visible max-md:border-0">
          {/* From 768px a table; on phones the same rows are laid out as one card per player */}
          <table className="w-full text-sm max-md:block">
            <thead className="max-md:hidden">
              <tr className="border-b border-line bg-raised">
                <th className="text-left px-3 py-3 @7xl:px-4 text-fg-muted font-medium">Name</th>
                <th className="text-left px-3 py-3 @7xl:px-4 text-fg-muted font-medium">TM ID</th>
                {tab !== "former" && <th className="text-left px-3 py-3 @7xl:px-4 text-fg-muted font-medium">{mayGetLogin(TAB_STATUS[tab]) ? "Linked account" : "Login"}</th>}
                <th className="text-left px-3 py-3 @7xl:px-4 text-fg-muted font-medium">Status</th>
                <th className="text-right px-3 py-3 @7xl:px-4 text-fg-muted font-medium whitespace-nowrap">Tournaments played</th>
                <th className="px-3 py-3 @7xl:px-4" />
              </tr>
            </thead>
            <tbody className="max-md:flex max-md:flex-col max-md:gap-3">
              {visible.map((player, i) => (
                <Fragment key={player.id}>
                {/* Members: the managers first, under a heading of their own */}
                {tab === "members" && managers.length > 0 && (i === 0 || i === managers.length) && (
                  <tr className="border-b border-line bg-raised/60 max-md:block max-md:border-0 max-md:bg-transparent">
                    <td colSpan={7} className="px-3 py-1.5 text-[11px] font-semibold  text-fg-muted @7xl:px-4 max-md:block max-md:px-0.5 max-md:py-0">
                      {i === 0 ? "Manager" : "Member"}
                    </td>
                  </tr>
                )}
                <tr
                  className={`border-b border-line last:border-0 ${i % 2 === 0 ? "bg-surface" : "bg-surface/60"} ${ownRow(player) && "own-row max-md:border-brand/60 max-md:[&>td:first-child]:!bg-none"} max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-3 max-md:rounded-xl max-md:border max-md:bg-surface max-md:p-3.5 max-md:last:border`}
                >
                  <td className="px-3 py-3 @7xl:px-4 font-medium text-fg max-md:order-1 max-md:col-span-2 max-md:block max-md:p-0 max-md:text-base">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {/* The flag says the country; managers change it right there */}
                      {canManage ? <CountryFlagPicker player={player} onChange={(country) => handleCountry(player.id, country)} /> : <PlayerAvatar player={player} />}
                      <Link href={playerPath(player)} className="hover:text-brand-ink hover:underline">{shownName(player)}</Link>
                      <button
                        type="button"
                        onClick={() => setNameDialog({ playerId: player.id })}
                        className="text-line-strong hover:text-fg"
                        title={canManage ? "Rename / name history" : "Name history"}
                      >
                        <Pencil size={11} />
                      </button>
                    </span>
                    {(player.nickname || allNames(player).length > 1) && (
                      <p className="mt-0.5 text-[11px] font-normal text-fg-subtle">
                        {[
                          player.nickname && player.name,
                          allNames(player).length > 1 && `formerly: ${allNames(player).filter((n) => n !== player.name).join(", ")}`,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {nameHint(player) && (
                      <HintLine label={`trackmania.io: ${nameHint(player)}`} canManage={canManage}
                        // A new name is a rename with a date, so it goes through the name history
                        onAdopt={() => setNameDialog({ playerId: player.id, suggestion: nameHint(player) ?? undefined })}
                        onDismiss={() => resolveHint(player, "name", "dismiss")} />
                    )}
                    {countryHint(player) && (
                      <HintLine label={`trackmania.io: ${countryName(countryHint(player)!)}`} canManage={canManage}
                        onAdopt={() => resolveHint(player, "country", "adopt")}
                        onDismiss={() => resolveHint(player, "country", "dismiss")} />
                    )}
                    {player.tmioCheckedAt && !player.tmioName && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-normal text-bronze">
                        not found on trackmania.io
                        {canManage && (
                          <button type="button" onClick={() => openRelink(player)} className="text-brand-ink hover:underline">Search</button>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 @7xl:px-4 font-mono text-xs text-fg-subtle max-md:order-3 max-md:block max-md:min-w-0 max-md:p-0 max-md:text-right">
                    <span className="block w-[9ch] truncate @7xl:w-auto max-md:ml-auto max-md:w-[14ch]" title={player.tmId}>{player.tmId}</span>
                  </td>
                  {tab !== "former" && <td className="px-3 py-3 @7xl:px-4 max-md:order-5 max-md:col-span-2 max-md:block max-md:min-w-0 max-md:p-0">
                    <span className="mb-1 block text-[10px]  text-fg-subtle md:hidden">{mayGetLogin(TAB_STATUS[tab]) ? "Account" : "Login"}</span>
                    {!mayGetLogin(currentStatus(player)) ? (
                      // Guests keep existing links; members and trials can link new accounts.
                      player.user ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-bronze">
                            <KeyRound size={12} />
                            {player.user.username}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => handleLink(player.id, null)}
                              disabled={linking === player.id}
                              className="text-fg-subtle hover:text-danger disabled:opacity-40"
                              title="Unlink"
                            >
                              <Link2Off size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-line-strong">—</span>
                      )
                    ) : canManage ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={player.user?.id ?? ""}
                          onChange={(e) => handleLink(player.id, e.target.value || null)}
                          disabled={linking === player.id}
                          className="h-7 w-32 max-md:h-9 max-md:min-w-0 max-md:flex-1 text-ellipsis rounded border border-line-strong bg-raised px-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                        >
                          <option value="">— no account —</option>
                          {availableUsers(player).map((u) => (
                            <option key={u.id} value={u.id}>
                              {userLabel(u)}
                            </option>
                          ))}
                        </select>
                        {player.user && (
                          <button
                            onClick={() => handleLink(player.id, null)}
                            disabled={linking === player.id}
                            className="text-fg-subtle hover:text-danger disabled:opacity-40"
                            title="Unlink"
                          >
                            <Link2Off size={13} />
                          </button>
                        )}
                        {!player.user && linking !== player.id && (
                          <Link2 size={13} className="text-line-strong" />
                        )}
                      </div>
                    ) : (
                      <span className="text-fg-muted">
                        {player.user?.name ?? <span className="text-line-strong">—</span>}
                      </span>
                    )}
                  </td>}
                  <td className="px-3 py-3 @7xl:px-4 max-md:order-2 max-md:block max-md:min-w-0 max-md:p-0">
                    <button
                      type="button"
                      onClick={() => setHistoryId(player.id)}
                      className="inline-flex items-center gap-1.5 text-left text-xs text-fg-muted hover:text-fg"
                      title="Show status history"
                    >
                      <History size={12} className="shrink-0" />
                      {statusSummary(player)}
                    </button>
                  </td>
                  <td className="px-3 py-3 @7xl:px-4 text-right text-fg-muted max-md:order-6 max-md:col-span-2 max-md:block max-md:p-0 max-md:text-left max-md:text-xs">
                    {player.tournamentsPlayed ?? 0}
                    <span className="md:hidden"> tournament{player.tournamentsPlayed === 1 ? "" : "s"} played</span>
                  </td>
                  <td className={cn("px-3 py-3 @7xl:px-4 text-right max-md:order-7 max-md:col-span-2 max-md:block max-md:border-t max-md:border-line max-md:p-0 max-md:pt-2.5", !canManage && "max-md:hidden")}>
                    {canManage && (
                      <div className="flex items-center justify-end gap-1 max-md:justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncOne(player)}
                          disabled={!!syncProgress || !!syncingId}
                          className="text-fg-subtle hover:text-fg"
                          title="Compare with trackmania.io"
                        >
                          <RefreshCw size={14} className={syncingId === player.id ? "animate-spin" : ""} />
                          <span className="md:hidden">Sync</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMoveId(player.id)}
                          className="whitespace-nowrap"
                          title="Change status"
                        >
                          <ArrowLeftRight size={13} />
                          <span className="hidden @7xl:inline max-md:inline">{tab === "trial" ? "To members" : "Status"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(player.id)}
                          disabled={deleting === player.id}
                          className="text-fg-subtle hover:text-danger"
                        >
                          <Trash2 size={14} />
                          <span className="md:hidden">Delete</span>
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add member / guest */}
      <Dialog open={canManage && showForm} onClose={closeForm} className="max-w-lg">
        <DialogTitle>{addLabel}</DialogTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tmio-search">Find on trackmania.io</Label>
            {searchField("tmio-search", pickResult, "No player found. You can still enter name and ID below.")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Tommy.TM" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmId">Trackmania player ID</Label>
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
            <p className="text-xs text-fg-subtle">
              {picked
                ? `Taken from trackmania.io${picked.country ? `, country ${countryName(picked.country)}` : ""}.`
                : "Filled in when you pick a search result, or paste the UUID by hand."}
            </p>
          </div>
          {newStatus !== "GUEST" && (
            <div className="space-y-1.5">
              <Label htmlFor="since">{newStatus === "TRIAL" ? "On trial since" : "Member since"}</Label>
              <Input id="since" type="date" value={formSince} max={localTodayKey()} onChange={(e) => setFormSince(e.target.value)} />
              <p className="text-xs text-fg-subtle">Leave empty for someone who has been with the team from the start.</p>
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : addLabel}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Find the trackmania.io account of a player that was not found */}
      <Dialog open={canManage && !!relinkPlayer} onClose={closeRelink} className="max-w-lg">
        <DialogTitle>Find {relinkPlayer?.name} on trackmania.io</DialogTitle>
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            The saved TM ID is unknown to trackmania.io. Pick the right account to correct it; name, lineups and results stay as they are.
          </p>
          <div className="space-y-1.5">
            {searchField("tmio-relink-search", setPicked, "No player found. Try another part of the name.")}
          </div>
          {picked && relinkPlayer && (
            <p className="break-all font-mono text-[11px] text-fg-subtle">
              {relinkPlayer.tmId} → <span className="text-fg">{picked.id}</span>
            </p>
          )}
          {relinkError && <p className="text-sm text-danger">{relinkError}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={closeRelink}>Cancel</Button>
            <Button type="button" onClick={handleRelink} disabled={!picked || relinkLoading}>
              {relinkLoading ? "Saving…" : "Use this account"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Move between members and guests */}
      {canManage && movePlayer && (
        <StatusMoveDialog
          player={movePlayer}
          onClose={() => setMoveId(null)}
          onChanged={(statusChanges, loginDeleted) => {
            replaceStatusChanges(movePlayer.id, statusChanges)
            if (loginDeleted) setPlayers((p) => p.map((pl) => (pl.id === movePlayer.id ? { ...pl, user: null } : pl)))
          }}
        />
      )}

      {/* Name history and renaming */}
      {namePlayer && (
        <NameHistoryDialog
          // A fresh dialog per player and suggestion, so no input is carried over
          key={`${namePlayer.id}-${nameDialog?.suggestion ?? ""}`}
          player={namePlayer}
          suggestion={nameDialog?.suggestion}
          canManage={canManage}
          onClose={() => setNameDialog(null)}
          onChanged={(history) =>
            setPlayers((p) =>
              p.map((pl) => (pl.id === namePlayer.id ? { ...pl, ...history } : pl))
            )
          }
        />
      )}

      {/* Status history */}
      {historyPlayer && (
        <StatusHistoryDialog
          player={historyPlayer}
          canManage={canManage}
          onClose={() => setHistoryId(null)}
          onChanged={(statusChanges) => replaceStatusChanges(historyPlayer.id, statusChanges)}
        />
      )}
    </div>
  )
}
