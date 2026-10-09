"use client"

import { EcmBookmarkletSetup } from "@/components/ecm-bookmarklet-setup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    matches: Array<{ id: string; slug: string | null; opponent: string | null; stageId: string }>
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
  const [opponentEdit, setOpponentEdit] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const tournament = tournaments.find((t) => t.id === (pickedTournament ?? suggestion?.tournamentId)) ?? tournaments[0]
  const lineup =
    tournament?.tournamentLineups.find((l) => l.id === (pickedLineup ?? suggestion?.lineupId)) ?? tournament?.tournamentLineups[0]
  const stages = sortStages(tournament?.stages ?? [])
  const startDate = tournament ? new Date(tournament.startDate ?? tournament.createdAt) : new Date()
  // The other team is the opponent; without a suggestion it is the second team on the page
  const opponent = opponentEdit ?? suggestion?.opponent ?? teams.find((t) => t !== lineup?.name) ?? ""
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
        setError("Diese Comp hat keinen Abschnitt für ein Match.")
        setSaving(false)
        return
      }
      const res = await fetch(`${BASE_PATH}/api/tournaments/${tournament.id}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: stage.id,
          opponent: opponent.trim() || null,
          date: stageDate(stage, stages, startDate).toISOString().slice(0, 10),
          notes: null,
          lineupId: lineup.id,
        }),
      }).catch(() => null)
      const data = await res?.json().catch(() => null)
      if (!res?.ok || !data?.id) {
        setError(data?.error ?? "Match konnte nicht angelegt werden")
        setSaving(false)
        return
      }
      target = data
    }
    // The match page picks the data up and opens the import dialog with it
    sessionStorage.setItem(ECM_PENDING_KEY, text)
    router.push(`${matchPath(tournament, lineup, target!)}?ecm=1`)
  }

  if (!payload) {
    return (
      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0f0]">eCM-Import</h1>
          <p className="mt-0.5 text-sm text-[#9a9090]">
            {fragment ? "Die mitgebrachten Daten sind nicht lesbar. Starte das Lesezeichen auf der eCM-Match-Seite bitte noch einmal." : "Hierher bringt dich das eCM-Lesezeichen mit den Daten eines Matches."}
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
        <h1 className="text-2xl font-bold text-[#f5f0f0]">eCM-Import</h1>
        <p className="mt-0.5 text-sm text-[#9a9090]">
          {teams.join(" vs ")} · {payload.sets.length} Sets, {rounds} Runden gelesen
        </p>
      </div>

      {tournaments.length === 0 || !tournament || !lineup ? (
        <p className="text-sm text-[#ED1F24]">Es gibt noch keine Comp mit einem Lineup, in die importiert werden könnte.</p>
      ) : (
        <>
          {!suggestion && (
            <p className="rounded-lg border border-[#cd7f32]/40 bg-[#cd7f32]/10 px-3 py-2 text-sm text-[#cd7f32]">
              Keines der beiden Teams heißt wie eines eurer Lineups. Wähle Comp und Lineup bitte selbst.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ecm-tournament">Comp</Label>
              <Select
                id="ecm-tournament"
                className={selectClass}
                value={tournament.id}
                onChange={(e) => { setPickedTournament(e.target.value); setPickedLineup(null); setPickedMatch(null); setPickedStage(null) }}
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
                    matchId === m.id ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]" : "border-[#2d2829] text-[#9a9090]"
                  )}
                >
                  <span className="flex-1">{m.opponent ? `vs ${m.opponent}` : "Seeding / ohne Gegner"}</span>
                  <span className="text-xs text-[#5e5858]">{matchStage ? stageName(matchStage, stages) : ""}</span>
                  {suggestedMatches.includes(m.id) && <span className="text-xs text-[#FBD00D]">Vorschlag</span>}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPickedMatch(NEW_MATCH)}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                matchId === NEW_MATCH ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]" : "border-dashed border-[#3a3435] text-[#9a9090]"
              )}
            >
              + Neues Match anlegen
            </button>
            {matchId === NEW_MATCH && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#2d2829] p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ecm-stage">Abschnitt</Label>
                  <Select id="ecm-stage" className={selectClass} value={stage?.id ?? ""} onChange={(e) => setPickedStage(e.target.value)}>
                    {stages.filter((s) => s.type !== "SEEDING").map((s) => (
                      <option key={s.id} value={s.id}>
                        {stageName(s, stages)} · {formatDay(stageDate(s, stages, startDate))}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ecm-opponent">Gegner</Label>
                  <Input id="ecm-opponent" value={opponent} onChange={(e) => setOpponentEdit(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <Button onClick={proceed} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Einen Moment…" : matchId === NEW_MATCH ? "Match anlegen und importieren" : "Weiter zum Import"}
          </Button>
          <p className="text-xs text-[#5e5858]">
            Danach öffnet sich auf der Match-Seite die Zuordnung von Sets und Spielern. Gespeichert wird erst dort.
          </p>
        </>
      )}
    </div>
  )
}
