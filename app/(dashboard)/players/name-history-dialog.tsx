"use client"

import { BASE_PATH } from "@/lib/base-path"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sortedNameChanges, type NameChange } from "@/lib/player-names"
import { dayKey, formatDay, localTodayKey } from "@/lib/player-status"
import { Trash2 } from "lucide-react"
import { useState } from "react"

export interface NameHistory {
  name: string
  initialName: string
  nameChanges: NameChange[]
  // What the team calls the player, shown instead of the gamertag (docs/adr/009-spitznamen.md)
  nickname?: string | null
}

interface Props {
  player: { id: string } & NameHistory
  // Name to offer for a new rename, e.g. the one found on trackmania.io
  suggestion?: string
  canManage: boolean
  onClose: () => void
  onChanged: (history: Partial<NameHistory>) => void
}

// The names a player had over time: the one from the start and every rename with its day.
// Inside a tournament the name on the tournament's start day is shown.
export function NameHistoryDialog({ player, suggestion, canManage, onClose, onChanged }: Props) {
  const changes = sortedNameChanges(player)
  const [initialName, setInitialName] = useState(player.initialName)
  const [nickname, setNickname] = useState(player.nickname ?? "")
  // Edited but not yet saved values of existing renames, keyed by their ID
  const [edits, setEdits] = useState<Record<string, { name?: string; day?: string }>>({})
  const [newName, setNewName] = useState(suggestion ?? "")
  const [newDay, setNewDay] = useState(localTodayKey())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function send(path: string, method: string, body?: unknown) {
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/players/${player.id}/names${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null)
    setLoading(false)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) {
      setError(data?.error ?? "Failed to save")
      return false
    }
    onChanged(data)
    return true
  }

  async function saveNickname() {
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    }).catch(() => null)
    setLoading(false)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) return setError(data?.error ?? "Failed to save")
    setNickname(data.nickname ?? "")
    onChanged({ nickname: data.nickname })
  }

  async function addRename() {
    if (await send("", "POST", { name: newName.trim(), effectiveFrom: newDay })) setNewName("")
  }

  async function saveChange(change: NameChange) {
    const edit = edits[change.id] ?? {}
    if (await send(`/${change.id}`, "PATCH", { name: edit.name?.trim(), effectiveFrom: edit.day })) {
      setEdits((e) => ({ ...e, [change.id]: {} }))
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogTitle>Names of {player.name}</DialogTitle>
      <div className="space-y-4">
        {(canManage || player.nickname) && (
          <div className="space-y-1.5 border-b border-line pb-3">
            <Label htmlFor="nickname">Nickname</Label>
            {canManage ? (
              <div className="flex items-center gap-2">
                <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Dennis" className="flex-1" />
                {nickname.trim() !== (player.nickname ?? "") && <Button onClick={saveNickname} disabled={loading}>Save</Button>}
              </div>
            ) : (
              <p className="text-sm font-medium text-fg">{player.nickname}</p>
            )}
            <p className="text-xs text-fg-subtle">Shown instead of the gamertag everywhere, the gamertag on hover. Empty shows the gamertag.</p>
          </div>
        )}
        <p className="text-xs text-fg-subtle">
          Inside a tournament the name of its start day is shown. Everywhere else it is the current name.
        </p>
        <ol className="space-y-2">
          <li className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
            <span className="w-36 shrink-0 text-xs text-fg-subtle">from the start</span>
            {canManage ? (
              <Input value={initialName} onChange={(e) => setInitialName(e.target.value)} aria-label="Name from the start" className="h-8 flex-1 text-sm" />
            ) : (
              <span className="flex-1 font-medium text-fg">{player.initialName}</span>
            )}
            {canManage && initialName.trim() && initialName.trim() !== player.initialName && (
              <Button size="sm" onClick={() => send("", "PUT", { initialName: initialName.trim() })} disabled={loading}>Save</Button>
            )}
          </li>
          {changes.map((change) => {
            const day = dayKey(change.effectiveFrom)
            const edit = edits[change.id] ?? {}
            const changed = (edit.name !== undefined && edit.name.trim() !== change.name && edit.name.trim() !== "") || (edit.day !== undefined && edit.day !== day)
            return (
              <li key={change.id} className="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
                {canManage ? (
                  <>
                    <Input
                      type="date"
                      value={edit.day ?? day}
                      max={localTodayKey()}
                      onChange={(e) => setEdits((all) => ({ ...all, [change.id]: { ...edit, day: e.target.value } }))}
                      aria-label="Applies from"
                      className="h-8 w-36 shrink-0 text-xs"
                    />
                    <Input
                      value={edit.name ?? change.name}
                      onChange={(e) => setEdits((all) => ({ ...all, [change.id]: { ...edit, name: e.target.value } }))}
                      aria-label="Name"
                      className="h-8 flex-1 text-sm"
                    />
                    {changed && <Button size="sm" onClick={() => saveChange(change)} disabled={loading}>Save</Button>}
                    <button
                      type="button"
                      onClick={() => send(`/${change.id}`, "DELETE")}
                      disabled={loading}
                      className="text-fg-subtle hover:text-danger disabled:opacity-40"
                      title="Remove this rename"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-36 shrink-0 text-xs text-fg-muted">ab {formatDay(day)}</span>
                    <span className="flex-1 font-medium text-fg">{change.name}</span>
                  </>
                )}
              </li>
            )
          })}
        </ol>

        {canManage && (
          <div className="space-y-1.5 border-t border-line pt-3">
            <Label htmlFor="rename-name">Rename</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={newDay}
                max={localTodayKey()}
                onChange={(e) => setNewDay(e.target.value)}
                aria-label="Applies from"
                className="w-40 shrink-0"
              />
              <Input id="rename-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New name" className="flex-1" />
              <Button onClick={addRename} disabled={loading || !newName.trim() || !newDay}>Add</Button>
            </div>
            <p className="text-xs text-fg-subtle">
              The date is the day the name applies from. For an earlier name, simply pick a date in the past.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="dialog-footer flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  )
}
