"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Download, Pencil, Trophy } from "lucide-react"
import { PlayerAvatar } from "@/components/player-avatar"
import { PlayerName } from "@/components/player-name"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import { shownName } from "@/lib/player-names"
import { mapLabel, mapsDrivenTwice, seedingScore, slotLabel, type RunResult, type SeedingSettings } from "@/lib/seeding"
import { cn } from "@/lib/utils"

export interface SeedingPlayer {
  id: string
  name: string
  nickname?: string | null
  country: string | null
}

export interface SeedingRunRow {
  subMatchId: string
  map: number
  slot: number
  server: number
  // Who drove it, once recorded; otherwise who was planned for it
  player: SeedingPlayer | null
  planned: SeedingPlayer | null
  score: number | null
}

interface Props {
  apiPath: string
  settings: SeedingSettings
  mapNames: string[]
  runs: SeedingRunRow[]
  place: number | null
  league: string | null
  // To pick the driver of a run by hand: the lineup's players first
  players: SeedingPlayer[]
  canEdit: boolean
  // The master sheet the comp's results came from last
  sheetUrl: string | null
}

interface Preview {
  teams: string[]
  team: string | null
  maps: string[]
  rank?: number | null
  league?: string | null
  total?: number | null
  runs?: RunResult[]
  // Names of the drivers found, by player id
  names?: Record<string, string>
  unknown?: Array<{ name: string; tmId: string }>
  unplaced?: Array<{ map: number; playerId: string; score: number }>
}

// The results of a seeding in a seeding format (docs/adr/010): the runs per map with their scores,
// the best ones of each map counted, the team's total, and the official place and league
export function SeedingResults({ apiPath, settings, mapNames, runs, place, league, players, canEdit, sheetUrl }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState("")
  const score = seedingScore(settings, runs.map((r) => ({ playerId: r.player?.id ?? null, score: r.score })))
  const twice = mapsDrivenTwice(settings, runs.map((r) => r.player?.id ?? null))
  const nameOf = (id: string) => players.find((p) => p.id === id) ?? runs.find((r) => r.player?.id === id)?.player

  async function send(body: Record<string, unknown>) {
    setError("")
    const res = await fetch(`${BASE_PATH}${apiPath}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error ?? "Could not save")
      return null
    }
    router.refresh()
    return data
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-xs text-fg-muted">Team total</p>
            <p className="text-2xl font-semibold tabular-nums text-fg">{score.total ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-fg-muted">Place</p>
            <p className="text-2xl font-semibold tabular-nums text-fg">{place ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-fg-muted">League</p>
            <p className="text-lg font-medium text-fg">{league ?? "—"}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setImporting(true)}>
              <Download size={14} />
              Import from master sheet
            </Button>
            <Button size="sm" variant={editing ? "secondary" : "outline"} onClick={() => setEditing((e) => !e)}>
              {editing ? <Check size={14} /> : <Pencil size={14} />}
              {editing ? "Done" : "Enter by hand"}
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-fg-muted">
            Place
            <Input type="number" min={1} defaultValue={place ?? ""} onBlur={(e) => void send({ action: "result", place: e.target.value ? Number(e.target.value) : null, league })} />
          </label>
          <label className="space-y-1 text-xs text-fg-muted">
            League
            <Input defaultValue={league ?? ""} placeholder="e.g. League 4 · Group H" onBlur={(e) => void send({ action: "result", place, league: e.target.value.trim() || null })} />
          </label>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {twice.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-bronze/40 bg-bronze/5 px-3 py-2 text-xs text-fg-soft">
          {twice.map((t) => (
            <li key={`${t.playerId}:${t.map}`} className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-bronze" />
              {nameOf(t.playerId) ? shownName(nameOf(t.playerId)!) : "A player"} drove {mapLabel(t.map, mapNames)} twice, which the rules do not allow.
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {score.maps.map((m, map) => (
          <Card key={map}>
            <CardContent className="pt-5">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-fg">{mapLabel(map, mapNames)}</h3>
                <span className="text-sm text-fg-muted">
                  Best {settings.best}: <span className="font-semibold tabular-nums text-fg">{m.sum}</span>
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-fg-muted">
                    <th className="pb-1 font-normal">Time</th>
                    <th className="pb-1 font-normal">Server</th>
                    <th className="pb-1 font-normal">Player</th>
                    <th className="pb-1 text-right font-normal">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, i) => {
                    if (run.map !== map) return null
                    const counted = m.counted.includes(i)
                    const shown = run.player ?? run.planned
                    return (
                      <tr key={run.subMatchId} className={cn("border-t border-table-rule", counted && "bg-brand/10")}>
                        <td className="py-1.5 pr-2 tabular-nums text-fg-muted">{slotLabel(settings, run.slot)}</td>
                        <td className="py-1.5 pr-2 text-fg-muted">{run.server + 1}</td>
                        <td className="py-1.5 pr-2">
                          {editing ? (
                            <Select
                              aria-label={`Player of ${mapLabel(map, mapNames)}, ${slotLabel(settings, run.slot)}, server ${run.server + 1}`}
                              className="h-8"
                              defaultValue={run.player?.id ?? ""}
                              onChange={(e) => void send({ action: "run", subMatchId: run.subMatchId, playerId: e.target.value || null, score: run.score })}
                            >
                              <option value="">—</option>
                              {players.map((p) => <option key={p.id} value={p.id}>{shownName(p)}</option>)}
                            </Select>
                          ) : shown ? (
                            <span className={cn("inline-flex items-center gap-1.5", !run.player && "text-fg-subtle")}>
                              <PlayerAvatar player={shown} className="h-4 w-4 text-[9px]" />
                              <PlayerName name={shown.name} nickname={shown.nickname} />
                              {!run.player && <span className="text-xs">planned</span>}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {editing ? (
                            <Input
                              type="number"
                              min={0}
                              aria-label="Score"
                              className="ml-auto h-8 w-24 text-right"
                              defaultValue={run.score ?? ""}
                              onBlur={(e) => {
                                const value = e.target.value === "" ? null : Number(e.target.value)
                                if (value !== run.score) void send({ action: "run", subMatchId: run.subMatchId, playerId: run.player?.id ?? null, score: value })
                              }}
                            />
                          ) : (
                            <span className={cn(counted ? "font-semibold text-fg" : "text-fg-muted")}>
                              {run.score ?? "—"}
                              {counted && <Trophy size={11} className="ml-1 inline text-brand-ink" aria-label="counted" />}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>

      {importing && (
        <ImportDialog
          apiPath={apiPath}
          sheetUrl={sheetUrl}
          settings={settings}
          runs={runs}
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}

function ImportDialog({ apiPath, sheetUrl, settings, runs, onClose, onDone }: {
  apiPath: string
  sheetUrl: string | null
  settings: SeedingSettings
  runs: SeedingRunRow[]
  onClose: () => void
  onDone: () => void
}) {
  const [url, setUrl] = useState(sheetUrl ?? "")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const nameOf = (id: string) => preview?.names?.[id] ?? "Unknown"

  async function call(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    const res = await fetch(`${BASE_PATH}${apiPath}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setBusy(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error ?? "Could not read the sheet")
      return null
    }
    return data
  }

  async function read(team?: string) {
    const data = await call({ action: "preview", url, ...(team && { team }) })
    if (data) setPreview(data)
  }

  async function takeOver() {
    if (!preview?.team) return
    if (await call({ action: "import", url, team: preview.team })) onDone()
  }

  const total = preview?.runs ? seedingScore(settings, preview.runs).total : null

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogTitle>Import from the master sheet</DialogTitle>
      <p className="mb-3 text-sm text-fg-muted">
        Reads the tabs “Seeding” and “Leagues”. Players are found by their Trackmania login; each score goes on the run the player drove or was planned for on that map.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Link to the master sheet" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
        <Button variant="outline" onClick={() => read(preview?.team ?? undefined)} disabled={busy || !url.trim()}>
          {busy ? "Reading…" : "Read"}
        </Button>
      </div>
      {preview && (
        <div className="mt-4 space-y-3">
          <label className="block space-y-1 text-xs text-fg-muted">
            Team in the sheet
            <Select value={preview.team ?? ""} onChange={(e) => void read(e.target.value)} disabled={busy}>
              <option value="" disabled>Pick the team</option>
              {preview.teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </label>
          {preview.team && preview.runs && (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge>Place {preview.rank ?? "—"}</Badge>
                <Badge>{preview.league ?? "No league"}</Badge>
                <Badge>Sheet total {preview.total ?? "—"}</Badge>
                {total !== preview.total && <Badge variant="yellow">Counted here {total ?? "—"}</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {preview.maps.map((name, map) => (
                  <div key={map} className="rounded-lg border border-line p-3 text-sm">
                    <p className="mb-1 font-semibold text-fg">{mapLabel(map, preview.maps)}</p>
                    {runs.map((run, i) => {
                      if (run.map !== map) return null
                      const result = preview.runs![i]
                      return (
                        <p key={run.subMatchId} className="flex justify-between gap-2 text-fg-soft">
                          <span>{slotLabel(settings, run.slot)} · S{run.server + 1} · {result?.playerId ? nameOf(result.playerId) : "—"}</span>
                          <span className="tabular-nums">{result?.score ?? ""}</span>
                        </p>
                      )
                    })}
                  </div>
                ))}
              </div>
              {(preview.unknown?.length ?? 0) > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-bronze">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  Not in the app, so left out: {preview.unknown!.map((u) => u.name).join(", ")}
                </p>
              )}
              {(preview.unplaced?.length ?? 0) > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-bronze">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  More drivers than runs, left out: {preview.unplaced!.map((u) => `${nameOf(u.playerId)} (${mapLabel(u.map, preview.maps)})`).join(", ")}
                </p>
              )}
              <p className="text-xs text-fg-subtle">Taking over replaces the runs, place and league of this match.</p>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      <div className="dialog-footer mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={takeOver} disabled={busy || !preview?.team || !preview.runs}>Take over</Button>
      </div>
    </Dialog>
  )
}
