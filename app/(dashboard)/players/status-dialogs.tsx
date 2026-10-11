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

export const STATUS_LABEL: Record<PlayerStatus, string> = { MEMBER: "Member", TRIAL: "Trial", GUEST: "Gast", FORMER: "Ehemalig" }

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

// "Gast seit 01.10.2026" or "Member von Anfang an"
export function statusSummary(player: StatusPlayer): string {
  const last = sortedChanges(player).at(-1)
  return last
    ? `${STATUS_LABEL[last.status]} seit ${formatDay(last.effectiveFrom)}`
    : `${STATUS_LABEL[player.initialStatus]} von Anfang an`
}

// As what a player took part: "als Member", "als Gast", "im Trial"
const AS_STATUS: Record<PlayerStatus, string> = { MEMBER: "als Member", TRIAL: "im Trial", GUEST: "als Gast", FORMER: "als Ehemaliger" }

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
      setError(data?.error ?? "Der Status konnte nicht geändert werden")
      return
    }
    onChanged(data.statusChanges, data.loginDeleted)
    onClose()
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Status von {player.name} ändern</DialogTitle>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Neuer Status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.filter((s) => s !== current).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTarget(s)}
                aria-pressed={target === s}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  target === s ? "border-[#FBD00D]/50 bg-[#FBD00D]/15 text-[#FBD00D]" : "border-[#3a3435] text-[#9a9090] hover:text-[#f5f0f0]"
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-[#9a9090]">
          Lineups, Ergebnisse und Flagge bleiben unverändert. Turniere, die vor dem gewählten Tag begonnen haben, zeigen{" "}
          {player.name} weiterhin {AS_STATUS[current]}.
          {target === "FORMER" && " Ehemalige werden nirgends mehr zur Auswahl angeboten; Profil und Ergebnisse bleiben."}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="move-date">{target === "MEMBER" ? "Member seit" : target === "TRIAL" ? "Im Trial seit" : "Gültig ab"}</Label>
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
            <p className="text-xs text-[#5e5858]">
              Muss nach dem letzten Wechsel am {formatDay(lastChange.effectiveFrom)} liegen.
            </p>
          )}
        </div>
        {player.user && (target === "GUEST" || target === "TRIAL") && (
          <p className="flex items-start gap-2 rounded-lg border border-[#cd7f32]/40 bg-[#cd7f32]/10 px-3 py-2 text-xs text-[#cd7f32]">
            <KeyRound size={14} className="mt-0.5 shrink-0" />
            Der Login „{player.user.username}“ bleibt aktiv. Lösch ihn auf der Accounts-Seite, wenn die Person keinen Zugang mehr haben soll.
          </p>
        )}
        {player.user && target === "FORMER" && (
          <p className="flex items-start gap-2 rounded-lg border border-[#ED1F24]/40 bg-[#ED1F24]/10 px-3 py-2 text-xs text-[#ED1F24]">
            <KeyRound size={14} className="mt-0.5 shrink-0" />
            Der Login „{player.user.username}“ wird dabei gelöscht. Die Person kann sich danach nicht mehr anmelden.
          </p>
        )}
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
        <div className="dialog-footer flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleMove} disabled={loading || !date}>
            {loading ? "Speichert …" : `Auf ${STATUS_LABEL[target]} setzen`}
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
      <DialogTitle>Statusverlauf von {player.name}</DialogTitle>
      <div className="space-y-4">
        <ol className="space-y-2">
          <li className="flex items-center gap-3 rounded-lg border border-[#2d2829] px-3 py-2 text-sm">
            {/* Whoever joined later starts as a guest: that stretch is the time before they joined */}
            {player.initialStatus === "GUEST" && changes.length > 0 ? (
              <span className="text-xs text-[#5e5858]">vor dem Beitritt</span>
            ) : (
              <>
                <span className="w-24 shrink-0 text-xs text-[#5e5858]">von Anfang an</span>
                <span className="font-medium text-[#f5f0f0]">{STATUS_LABEL[player.initialStatus]}</span>
              </>
            )}
          </li>
          {timeline.map((entry) =>
            entry.kind === "change" ? (
              <li key={entry.change.id} className="flex items-center gap-3 rounded-lg border border-[#FBD00D]/30 bg-[#FBD00D]/5 px-3 py-2 text-sm">
                {canManage ? (
                  <Input
                    type="date"
                    value={dates[entry.change.id] ?? entry.day}
                    max={localTodayKey()}
                    onChange={(e) => setDates((d) => ({ ...d, [entry.change.id]: e.target.value }))}
                    aria-label="Gültig ab"
                    className="h-8 w-36 shrink-0 text-xs"
                  />
                ) : (
                  <span className="w-24 shrink-0 text-xs text-[#9a9090]">{formatDay(entry.day)}</span>
                )}
                <span className="flex-1 font-medium text-[#f5f0f0]">{STATUS_LABEL[entry.change.status]}</span>
                {canManage && dates[entry.change.id] && dates[entry.change.id] !== entry.day && (
                  <Button size="sm" onClick={() => send(entry.change, "PATCH", "Speichern fehlgeschlagen")} disabled={loading}>Speichern</Button>
                )}
                {canManage && entry.change.id === changes.at(-1)?.id && (
                  <button
                    type="button"
                    onClick={() => confirm("Diesen Wechsel entfernen?") && send(entry.change, "DELETE", "Entfernen fehlgeschlagen")}
                    disabled={loading}
                    className="text-[#5e5858] hover:text-[#ED1F24] disabled:opacity-40"
                    title="Diesen Wechsel entfernen"
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
                  {AS_STATUS[entry.status]}
                </span>
              </li>
            )
          )}
        </ol>
        {timeline.length === 0 && (
          <p className="text-xs text-[#5e5858]">Noch keine Wechsel und keine Turniere.</p>
        )}
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
        <div className="dialog-footer flex justify-end">
          <Button variant="ghost" onClick={onClose}>Schließen</Button>
        </div>
      </div>
    </Dialog>
  )
}
