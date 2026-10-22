"use client"

import { EcmBookmarkletSetup } from "@/components/ecm-bookmarklet-setup"
import { Button } from "@/components/ui/button"
import { OpponentPicker, type OpponentValue } from "@/components/opponents/opponent-picker"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import { decodeEcmFragment, ECM_PENDING_KEY, parseEcmPayload } from "@/lib/ecm"
import { suggestEcmTarget } from "@/lib/ecm-match"
import { matchPath } from "@/lib/paths"
import { formatDay } from "@/lib/player-status"
import { sortStages, stageDate, stageName, suggestStage, type StageRef } from "@/lib/stages"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useState, useSyncExternalStore } from "react"

interface Tournament {
  id: string
  slug: string | null
  name: string
  startDate: Date | null
  createdAt: Date
  stages: StageRef[]
  tournamentLineups: Array<{
    id: string
    slug: string | null
    name: string
    matches: Array<{ id: string; slug: string | null; opponent: string | null; opponentLineupId?: string | null; opponentLineup?: { name: string; aliases: string[] } | null; stageId: string }>
  }>
}

const NEW_MATCH = "new"

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

export function EcmImportView({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter()
  // The bookmarklet puts the data behind the # of the address
  const fragment = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "")
  const text = decodeEcmFragment(fragment)
  const payload = text ? parseEcmPayload(text) : null
  const teams = payload?.teams.map((t) => t.name) ?? []
  const suggestion = suggestEcmTarget(teams, tournaments)

  // What the user picked; until then the suggestion applies
  const [pickedTournament, setPickedTournament] = useState<string | null>(null)
  const [pickedLineup, setPickedLineup] = useState<string | null>(null)
  const [pickedMatch, setPickedMatch] = useState<string | null>(null)
  const [pickedStage, setPickedStage] = useState<string | null>(null)
  const [opponentChoice, setOpponentChoice] = useState<OpponentValue | null>(null)
  const [rememberAlias, setRememberAlias] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const tournament = tournaments.find((t) => t.id === (pickedTournament ?? suggestion?.tournamentId)) ?? tournaments[0]
  const lineup =
    tournament?.tournamentLineups.find((l) => l.id === (pickedLineup ?? suggestion?.lineupId)) ?? tournament?.tournamentLineups[0]
  const stages = sortStages(tournament?.stages ?? [])
  const startDate = tournament ? new Date(tournament.startDate ?? tournament.createdAt) : new Date()
  // The other team is the opponent; without a suggestion it is the second team on the page
  const opponent = opponentChoice?.name ?? suggestion?.opponent ?? teams.find((t) => t !== lineup?.name) ?? ""
  const suggestedMatches = suggestion?.lineupId === lineup?.id ? suggestion?.matchIds ?? [] : []
  const matchId = pickedMatch ?? suggestedMatches[0] ?? NEW_MATCH
  const stage =
    stages.find((s) => s.id === pickedStage) ??
    suggestStage(stages.filter((s) => s.type !== "SEEDING"), lineup?.matches.map((m) => m.stageId) ?? [])

  async function proceed() {
    if (!tournament || !lineup || !text) return
    setError("")
    setSaving(true)
    let target = lineup.matches.find((m) => m.id === matchId)
    if (!target) {
      if (!stage) {
        setError("This tournament has no stage for a match.")
        setSaving(false)
        return
      }
      const res = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: stage.id,
          opponent: opponent.trim() || null,
          opponentLineupId: opponentChoice?.lineupId,
          opponentTeamId: opponentChoice?.teamId,
          date: stageDate(stage, stages, startDate).toISOString().slice(0, 10),
          notes: null,
          lineupId: lineup.id,
        }),
      }).catch(() => null)
      const data = await res?.json().catch(() => null)
      if (!res?.ok || !data?.id) {
        setError(data?.error ?? "Failed to create the match")
        setSaving(false)
        return
      }
      target = data
    }
    if (rememberAlias && target) {
      const originalName = suggestion?.opponent ?? teams.find(t => t !== lineup.name)
      if (originalName) {
        const saved = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/matches/${target.id}/opponent`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", alias: originalName }) })
        if (!saved.ok) { const body = await saved.json().catch(() => null); setError(body?.error ?? "Failed to save the import name."); setSaving(false); return }
      }
    }
    // The match page picks the data up and opens the import dialog with it
    sessionStorage.setItem(ECM_PENDING_KEY, text)
    router.push(`${matchPath(tournament, lineup, target!)}?ecm=1`)
  }

  if (!payload) {
    return (
      <div className="page-narrow space-y-5">
        <div>
          <h1 className="text-fg page-title">eCM import</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            {fragment ? "The data that came along cannot be read. Please start the bookmark on the eCM match page once more." : "The eCM bookmark brings you here with the data of a match."}
          </p>
        </div>
        <EcmBookmarkletSetup />
      </div>
    )
  }

  const rounds = payload.sets.reduce((sum, s) => sum + s.rounds.length, 0)
  const selectClass = "h-10"

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-fg page-title">eCM import</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          {teams.join(" vs ")} · {payload.sets.length} sets, {rounds} rounds read
        </p>
      </div>

      {tournaments.length === 0 || !tournament || !lineup ? (
        <p className="text-sm text-danger">There is no tournament with a lineup yet that could be imported into.</p>
      ) : (
        <>
          {!suggestion && (
            <p className="rounded-lg border border-bronze/40 bg-bronze/10 px-3 py-2 text-sm text-bronze">
              Neither team is named like one of your lineups. Please pick tournament and lineup yourself.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ecm-tournament">Tournament</Label>
              <Select
                id="ecm-tournament"
                className={selectClass}
                value={tournament.id}
                onChange={(e) => { setPickedTournament(e.target.value); setOpponentChoice(null); setRememberAlias(false); setPickedLineup(null); setPickedMatch(null); setPickedStage(null) }}
              >
                {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ecm-lineup">Lineup</Label>
              <Select
                id="ecm-lineup"
                className={selectClass}
                value={lineup.id}
                onChange={(e) => { setPickedLineup(e.target.value); setPickedMatch(null) }}
              >
                {tournament.tournamentLineups.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Match</Label>
            {lineup.matches.map((m) => {
              const matchStage = stages.find((s) => s.id === m.stageId)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPickedMatch(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    matchId === m.id ? "border-brand/50 bg-brand/10 text-fg" : "border-line text-fg-muted"
                  )}
                >
                  <span className="flex-1">{m.opponent ? `vs ${m.opponent}` : "Seeding / no opponent"}</span>
                  <span className="text-xs text-fg-subtle">{matchStage ? stageName(matchStage, stages) : ""}</span>
                  {suggestedMatches.includes(m.id) && <span className="text-xs text-brand-ink">suggested</span>}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPickedMatch(NEW_MATCH)}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                matchId === NEW_MATCH ? "border-brand/50 bg-brand/10 text-fg" : "border-dashed border-line-strong text-fg-muted"
              )}
            >
              + Add a new match
            </button>
            {matchId === NEW_MATCH && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ecm-stage">Stage</Label>
                  <Select id="ecm-stage" className={selectClass} value={stage?.id ?? ""} onChange={(e) => setPickedStage(e.target.value)}>
                    {stages.filter((s) => s.type !== "SEEDING").map((s) => (
                      <option key={s.id} value={s.id}>
                        {stageName(s, stages)} · {formatDay(stageDate(s, stages, startDate))}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ecm-opponent">Opponent</Label>
                  <OpponentPicker inputId="ecm-opponent" competitionId={tournament.id} value={opponentChoice ?? { name: opponent }} onChange={setOpponentChoice} />
                </div>
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-fg-muted"><input type="checkbox" checked={rememberAlias} onChange={e => setRememberAlias(e.target.checked)} />Remember the import name for the chosen opponent in this tournament</label>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={proceed} disabled={saving} className="w-full sm:w-auto">
            {saving ? "One moment…" : matchId === NEW_MATCH ? "Add match and import" : "Continue to the import"}
          </Button>
          <p className="text-xs text-fg-subtle">
            After that the match page opens the assignment of sets and players. Nothing is saved before that.
          </p>
        </>
      )}
    </div>
  )
}
