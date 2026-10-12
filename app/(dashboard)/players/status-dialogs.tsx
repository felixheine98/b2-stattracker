"use client"

import { BASE_PATH } from "@/lib/base-path"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  STATUSES,
  currentStatus,
  dayKey,
  formatDay,
  localTodayKey,
  sortedChanges,
  statusAt,
  suggestedStatus,
  tournamentReferenceDate,
  type PlayerStatus,
  type StatusChange,
} from "@/lib/player-status"
import { cn } from "@/lib/utils"
import { KeyRound, Trash2, Trophy } from "lucide-react"
import { useState } from "react"

export const STATUS_LABEL: Record<PlayerStatus, string> = { MEMBER: "Member", TRIAL: "Trial", GUEST: "Guest", FORMER: "Former" }

export interface StatusPlayer {
  id: string
  name: string
  initialStatus: PlayerStatus
  statusChanges: StatusChange[]
  tournamentLineupSlots?: Array<{
    lineup: {
      name: string
      tournament: { id: string; name: string; startDate: Date | string | null; createdAt: Date | string }
    }
  }>
  user?: { username: string } | null
}

interface Props {
  player: StatusPlayer
  onClose: () => void
  // loginDeleted: the player's login went with the switch (see the status route)
  onChanged: (statusChanges: StatusChange[], loginDeleted?: boolean) => void
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return dayKey(date)
}

// "Guest since 01.10.2026" or "Member from the start"
export function statusSummary(player: StatusPlayer): string {
  const last = sortedChanges(player).at(-1)
  return last
    ? `${STATUS_LABEL[last.status]} since ${formatDay(last.effectiveFrom)}`
    : `${STATUS_LABEL[player.initialStatus]} from the start`
}

// As what a player took part: "as a member", "as a guest", "on trial"
const AS_STATUS: Record<PlayerStatus, string> = { MEMBER: "as a member", TRIAL: "on trial", GUEST: "as a guest", FORMER: "as a former player" }

// Give a player another status from a given day on: a trial that becomes a membership, a
// member who goes on as a guest and so on
export function StatusMoveDialog({ player, onClose, onChanged }: Props) {
  const current = currentStatus(player)
  const [target, setTarget] = useState<PlayerStatus>(suggestedStatus(current))
  const [date, setDate] = useState(localTodayKey())
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const lastChange = sortedChanges(player).at(-1)
  const minDate = lastChange ? nextDay(dayKey(lastChange.effectiveFrom)) : undefined

  async function handleMove() {
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/players/${player.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target, effectiveFrom: date }),
    })
    setLoading(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error ?? "Failed to change the status")
      return
    }
    onChanged(data.statusChanges, data.loginDeleted)
    onClose()
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Change status of {player.name}</DialogTitle>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>New status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.filter((s) => s !== current).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTarget(s)}
                aria-pressed={target === s}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  target === s ? "border-brand/50 bg-brand/15 text-brand-ink" : "border-line-strong text-fg-muted hover:text-fg"
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-fg-muted">
          Lineups, results and the flag stay as they are. Tournaments that started before the chosen day keep showing{" "}
          {player.name} {AS_STATUS[current]}.
          {target === "FORMER" && " Former players are no longer offered for picking; profile and results are kept."}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="move-date">{target === "MEMBER" ? "Member since" : target === "TRIAL" ? "On trial since" : "Effective from"}</Label>
          <Input
            id="move-date"
            type="date"
            value={date}
            min={minDate}
            max={localTodayKey()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          {lastChange && (
            <p className="text-xs text-fg-subtle">
              Must be after the previous switch on {formatDay(lastChange.effectiveFrom)}.
            </p>
          )}
        </div>
        {player.user && (target === "GUEST" || target === "TRIAL") && (
          <p className="flex items-start gap-2 rounded-lg border border-bronze/40 bg-bronze/10 px-3 py-2 text-xs text-bronze">
            <KeyRound size={14} className="mt-0.5 shrink-0" />
            The login “{player.user.username}” stays active. Delete it on the Accounts page if this person should no longer have access.
          </p>
        )}
        {player.user && target === "FORMER" && (
          <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            <KeyRound size={14} className="mt-0.5 shrink-0" />
            The login “{player.user.username}” is deleted with this. The person can no longer sign in afterwards.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="dialog-footer flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMove} disabled={loading || !date}>
            {loading ? "Saving…" : `Set to ${STATUS_LABEL[target].toLowerCase()}`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// The switches between member and guest next to the tournaments played, so it shows as what
// the player took part in each. Managers can correct the day of a switch and take back the last one.
export function StatusHistoryDialog({ player, canManage, onClose, onChanged }: Props & { canManage: boolean }) {
  const [dates, setDates] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function send(change: StatusChange, method: "PATCH" | "DELETE", failure: string) {
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/players/${player.id}/status/${change.id}`, {
      method,
      ...(method === "PATCH" && { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ effectiveFrom: dates[change.id] }) }),
    })
    setLoading(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error ?? failure)
      return
    }
    onChanged(data.statusChanges)
    setDates({})
  }

  // Switches and tournaments in one timeline; on the same day the switch comes first
  const changes = sortedChanges(player)
  const timeline = [
    ...changes.map((change) => ({ kind: "change" as const, day: dayKey(change.effectiveFrom), change })),
    ...(player.tournamentLineupSlots ?? []).map((slot) => {
      const day = dayKey(tournamentReferenceDate(slot.lineup.tournament))
      return { kind: "tournament" as const, day, slot, status: statusAt(player, day) }
    }),
  ].sort((a, b) => a.day.localeCompare(b.day) || (a.kind === b.kind ? 0 : a.kind === "change" ? -1 : 1))

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogTitle>Status history of {player.name}</DialogTitle>
      <div className="space-y-4">
        <ol className="space-y-2">
          <li className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
            {/* Whoever joined later starts as a guest: that stretch is the time before they joined */}
            {player.initialStatus === "GUEST" && changes.length > 0 ? (
              <span className="text-xs text-fg-subtle">before joining</span>
            ) : (
              <>
                <span className="w-24 shrink-0 text-xs text-fg-subtle">from the start</span>
                <span className="font-medium text-fg">{STATUS_LABEL[player.initialStatus]}</span>
              </>
            )}
          </li>
          {timeline.map((entry) =>
            entry.kind === "change" ? (
              <li key={entry.change.id} className="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
                {canManage ? (
                  <Input
                    type="date"
                    value={dates[entry.change.id] ?? entry.day}
                    max={localTodayKey()}
                    onChange={(e) => setDates((d) => ({ ...d, [entry.change.id]: e.target.value }))}
                    aria-label="Effective from"
                    className="h-8 w-36 shrink-0 text-xs"
                  />
                ) : (
                  <span className="w-24 shrink-0 text-xs text-fg-muted">{formatDay(entry.day)}</span>
                )}
                <span className="flex-1 font-medium text-fg">{STATUS_LABEL[entry.change.status]}</span>
                {canManage && dates[entry.change.id] && dates[entry.change.id] !== entry.day && (
                  <Button size="sm" onClick={() => send(entry.change, "PATCH", "Failed to save")} disabled={loading}>Save</Button>
                )}
                {canManage && entry.change.id === changes.at(-1)?.id && (
                  <button
                    type="button"
                    onClick={() => confirm("Remove this switch?") && send(entry.change, "DELETE", "Failed to remove")}
                    disabled={loading}
                    className="text-fg-subtle hover:text-danger disabled:opacity-40"
                    title="Remove this switch"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ) : (
              <li key={`${entry.slot.lineup.tournament.id}-${entry.slot.lineup.name}`} className="flex items-center gap-3 px-3 py-1 text-sm">
                <span className="w-24 shrink-0 text-xs text-fg-subtle">{formatDay(entry.day)}</span>
                <Trophy size={13} className="shrink-0 text-fg-subtle" />
                <span className="flex-1 text-fg-soft">
                  {entry.slot.lineup.tournament.name}
                  <span className="text-fg-subtle"> · {entry.slot.lineup.name}</span>
                </span>
                <span className={cn("text-xs", entry.status === "GUEST" ? "text-bronze" : "text-fg-muted")}>
                  {AS_STATUS[entry.status]}
                </span>
              </li>
            )
          )}
        </ol>
        {timeline.length === 0 && (
          <p className="text-xs text-fg-subtle">No switches and no tournaments yet.</p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="dialog-footer flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  )
}
