"use client"

import { EcmBookmarkletSetup } from "@/components/ecm-bookmarklet-setup"
import { ImportCheckPanel } from "@/components/import-check-panel"
import { BASE_PATH } from "@/lib/base-path"
import { localTodayKey } from "@/lib/player-status"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { repairEcmSet, ECM_PENDING_KEY, normalizeName, parseEcmPayload, type EcmPayload, type EcmSet } from "@/lib/ecm"
import { useImportCheck } from "@/lib/use-import-check"
import { subMatchState, type RuleSet } from "@/lib/match-rules"
import { formatLabel, parseTime, teamSize } from "@/lib/utils"
import { useMemo, useState } from "react"
import type { Player, Round, SubMatch } from "./match-detail-view"

const MAPPING_KEY = "ecm-player-map"

const isDnf = (time: string | undefined) => time?.trim().toUpperCase() === "DNF"
const isEcmUrl = (url: string | undefined) => !!url && /^https:\/\/([a-z0-9-]+\.)*ecircuitmania\.com\//i.test(url)

interface Props {
  tournamentId: string
  matchId: string
  subMatches: SubMatch[]
  // Format rules of this match: what would be saved is checked against them, as a warning only
  ruleSet: RuleSet | null
  allPlayers: Player[]
  // Start day of the tournament (YYYY-MM-DD): the day a name taken over from eCM counts from
  startDay: string
  // Admin or manager: may enter an eCM name into a player's name history
  canManage: boolean
  isGuest: (tmId: string) => boolean
  onClose: () => void
  // url is the eCircuitMania page that was saved along with the rounds
  onImported: (subMatchId: string, rounds: Round[], url?: string) => void
}

interface SetAnalysis {
  size: number
  // eCM names of our players in this set, in order of first appearance
  ourNames: string[]
  error?: string
}

function analyzeSet(set: EcmSet, isOurs: (name: string) => boolean): SetAnalysis {
  const count = set.rounds[0]?.length ?? 0
  if (count === 0) return { size: 0, ourNames: [], error: "no rounds" }
  if (count % 2 !== 0 || set.rounds.some((r) => r.length !== count)) {
    return { size: 0, ourNames: [], error: "number of players differs between rounds" }
  }
  const size = count / 2
  const ourNames: string[] = []
  for (const round of set.rounds) {
    const ours = round.filter((e) => isOurs(e.p))
    if (ours.length !== size) return { size, ourNames, error: "teams do not add up" }
    for (const e of ours) if (!ourNames.includes(e.p)) ourNames.push(e.p)
  }
  if (ourNames.length !== size) return { size, ourNames, error: "players change within the set" }
  return { size, ourNames }
}

function loadSavedMapping(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAPPING_KEY) ?? "{}")
  } catch {
    return {}
  }
}

export function EcmImportDialog({ tournamentId, matchId, subMatches, ruleSet, allPlayers, startDay, canManage, isGuest, onClose: close, onImported }: Props) {
  const router = useRouter()
  const onClose = () => {
    sessionStorage.removeItem(ECM_PENDING_KEY)
    close()
  }
  // Data handed over by the import page (see app/(dashboard)/ecm-import); stays there until the dialog is done
  const [text, setText] = useState(() => (typeof window === "undefined" ? "" : sessionStorage.getItem(ECM_PENDING_KEY) ?? ""))
  const [teamChoice, setTeamChoice] = useState<number | null>(null)
  const [mappingEdits, setMappingEdits] = useState<Record<string, string>>({})
  const [savedMapping] = useState(loadSavedMapping)
  const [targetEdits, setTargetEdits] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Rounds with a player too many or too few are repaired where possible; repairs[i] says how for set i
  const { payload, repairs } = useMemo(() => {
    const parsed = parseEcmPayload(text)
    const repairs = parsed?.sets.map(repairEcmSet) ?? []
    const payload: EcmPayload | null = parsed && { ...parsed, sets: repairs.map((r) => r.set) }
    return { payload, repairs }
  }, [text])

  // A player is recognised by any name they ever had, not only the one shown in this tournament
  const namesOf = (p: Player) => p.allNames ?? [p.name]
  const playerByNormalized = useMemo(
    () => new Map(allPlayers.flatMap((p) => (p.allNames ?? [p.name]).map((n) => [normalizeName(n), p] as const))),
    [allPlayers]
  )
  const autoMatch = (name: string) =>
    allPlayers.find((p) => namesOf(p).some((n) => n.toLowerCase() === name.toLowerCase())) ?? playerByNormalized.get(normalizeName(name))

  // Our team is the one whose roster contains more known players
  const autoTeam = useMemo(() => {
    if (!payload) return 0
    const known = payload.teams.map((t) => t.players.filter((n) => autoMatch(n)).length)
    return known.indexOf(Math.max(...known, 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])
  const ourTeam = teamChoice ?? Math.max(autoTeam, 0)
  const roster = payload?.teams[ourTeam]?.players ?? []
  const isOurs = (name: string) => (roster.length > 0 ? roster.includes(name) : !!autoMatch(name))

  const analyses = payload?.sets.map((set) => analyzeSet(set, isOurs)) ?? []
  const playerIdFor = (name: string) => mappingEdits[name] ?? savedMapping[name] ?? autoMatch(name)?.id ?? ""

  // Each set goes to the first free sub-match with the same team size
  const targets: string[] = []
  analyses.forEach((a, i) => {
    if (targetEdits[i] !== undefined) {
      targets[i] = targetEdits[i]
      return
    }
    const free = subMatches.find((sm) => !a.error && teamSize(sm.format) === a.size && !targets.includes(sm.id))
    targets[i] = free?.id ?? ""
  })

  const selected = analyses.map((a, i) => !a.error && targets[i] !== "")
  const neededNames = [...new Set(analyses.flatMap((a, i) => (selected[i] ? a.ourNames : [])))]
  const problems: string[] = []
  analyses.forEach((a, i) => {
    if (!selected[i]) return
    const ids = a.ourNames.map(playerIdFor)
    if (ids.some((id) => !id)) problems.push(`${payload!.sets[i].label}: not all players are assigned`)
    else if (new Set(ids).size !== ids.length) problems.push(`${payload!.sets[i].label}: a player is assigned twice`)
    if (targets.filter((t, j) => selected[j] && t === targets[i]).length > 1) {
      problems.push(`${payload!.sets[i].label}: sub-match picked more than once`)
    }
  })
  // eCM names that differ from the name the mapped player has in this tournament
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renamed, setRenamed] = useState<string[]>([])
  const nameDiffs = neededNames.flatMap((ecmName) => {
    const player = allPlayers.find((p) => p.id === playerIdFor(ecmName))
    return player && player.name !== ecmName && !renamed.includes(ecmName) ? [{ ecmName, player }] : []
  })

  // Enter the eCM name as the player's name from the tournament's start day on; today's name stays
  async function adoptEcmName(ecmName: string, playerId: string) {
    setRenaming(ecmName)
    setError("")
    const res = await fetch(`${BASE_PATH}/api/players/${playerId}/names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ecmName, effectiveFrom: startDay, keepCurrentFrom: localTodayKey() }),
    }).catch(() => null)
    setRenaming(null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Failed to save the name")
      return
    }
    setRenamed((names) => [...names, ecmName])
    router.refresh()
  }

  // What would be saved, compared with what is entered for the match. eCM knows the opponent's
  // drivers by name only, so of the other team just those count whose name is one of ours.
  const otherTeam = payload?.teams.length === 2 ? payload.teams[1 - ourTeam] : null
  const profileOf = (name: string) => allPlayers.find((p) => p.id === playerIdFor(name))
  const selectedSets = payload?.sets.filter((_, i) => selected[i]) ?? []
  const foreignNames = [...new Set(selectedSets.flatMap((set) => set.rounds.flatMap((round) => round.filter((e) => !isOurs(e.p)).map((e) => e.p))))]
  const check = useImportCheck(tournamentId, matchId, payload && selected.some(Boolean) && problems.length === 0
    ? {
        ours: neededNames.flatMap((n) => { const p = profileOf(n); return p ? [{ tmId: p.tmId, name: p.name }] : [] }),
        foreign: foreignNames.flatMap((n) => { const p = autoMatch(n); return p ? [{ tmId: p.tmId, name: p.name }] : [] }),
        firstRoundTime: null,
        // Our drivers of every set, compared with the finalised lineup of its sub-match's format
        driven: analyses.flatMap((a, i) => {
          const format = subMatches.find((sm) => sm.id === targets[i])?.format
          return selected[i] && format ? [{ format, drivers: a.ourNames.flatMap((n) => { const p = profileOf(n); return p ? [{ tmId: p.tmId, name: p.name }] : [] }) }] : []
        }),
        ...(otherTeam && { teams: { own: payload.teams[ourTeam].name, opponent: otherTeam.name } }),
      }
    : null)

  const canImport = selected.some(Boolean) && problems.length === 0 && !saving && check.ready

  async function handleImport() {
    if (!payload) return
    const ecmUrl = isEcmUrl(payload.url) ? payload.url : undefined
    setSaving(true)
    setError("")
    try {
      localStorage.setItem(
        MAPPING_KEY,
        JSON.stringify({ ...savedMapping, ...Object.fromEntries(neededNames.map((n) => [n, playerIdFor(n)])) })
      )
    } catch {
      // Remembering the mapping is only a convenience
    }
    for (const [i, set] of payload.sets.entries()) {
      if (!selected[i]) continue
      const names = analyses[i].ourNames
      const res = await fetch(`${BASE_PATH}/api/submatches/${targets[i]}/rounds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: names.map(playerIdFor),
          track: set.map,
          ...(ecmUrl && { ecmUrl }),
          rounds: set.rounds.map((round) => ({
            positions: names.map((n) => round.findIndex((e) => e.p === n) + 1),
            times: names.map((n) => parseTime(round.find((e) => e.p === n)?.t ?? "") ?? null),
            dnf: names.map((n) => isDnf(round.find((e) => e.p === n)?.t)),
            opponents: round
              .filter((e) => !isOurs(e.p))
              .map((e) => ({ name: e.p, timeMs: parseTime(e.t) ?? null, dnf: isDnf(e.t) })),
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(`${set.label}: ${data?.error ?? "Import failed"}`)
        setSaving(false)
        return
      }
      const data = await res.json()
      onImported(targets[i], data.rounds, ecmUrl)
    }
    // The line about the hints the import was confirmed despite, or none any more
    await fetch(`${BASE_PATH}/api/tournaments/${tournamentId}/matches/${matchId}/import/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warnings: check.warnings }),
    }).catch(() => null)
    router.refresh()
    setSaving(false)
    onClose()
  }

  const selectClass =
    "h-8 rounded-md border border-line-strong bg-raised px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-brand"

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogTitle>Import from eCircuitMania</DialogTitle>

      {!payload ? (
        <div className="space-y-4">
          <p className="text-sm text-fg-soft">
            The bookmark is the quickest way: it reads the match page on ecircuitmania.com and brings
            you straight here with the data.
          </p>
          <EcmBookmarkletSetup />
          <p className="text-xs text-fg-subtle">
            Only if the bookmark shows a window to copy from (very large match): paste the copied data here.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="font-mono text-xs"
            placeholder="Paste the copied data here (Ctrl+V)"
          />
          {text.trim() && <p className="text-sm text-danger">This is not data from the eCM bookmark.</p>}
          <div className="dialog-footer flex justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {payload.teams.length > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-fg-muted">Unser Team</span>
              {payload.teams.map((team, i) => (
                <button
                  key={team.name}
                  type="button"
                  onClick={() => setTeamChoice(i)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    i === ourTeam
                      ? "border-brand/50 bg-brand/10 text-fg"
                      : "border-line text-fg-muted hover:border-line-strong"
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-fg">Sets</p>
            {payload.sets.map((set, i) => {
              const a = analyses[i]
              const targetFormat = selected[i] ? subMatches.find((sm) => sm.id === targets[i])?.format : undefined
              const ruleHint = targetFormat
                ? subMatchState(set.rounds.map((round) => ({ results: round.map((e) => ({ isOurTeam: isOurs(e.p), dnf: isDnf(e.t) })) })), ruleSet?.formatRules[targetFormat] ?? null).hint
                : null
              return (
                <div key={i} className="flex flex-wrap items-center gap-x-3 rounded-lg border border-line px-3 py-2 text-sm">
                  {ruleHint && <p className="order-last w-full pt-1 text-xs text-bronze">{ruleHint}. Check the rounds on eCM.</p>}
                  {repairs[i].dropped.length > 0 && (
                    <p className="order-last w-full pt-1 text-xs text-bronze">
                      Ignored, as surplus and never finished:{" "}
                      {repairs[i].dropped.map((d) => `${d.player} (round ${d.round})`).join(", ")}
                    </p>
                  )}
                  {repairs[i].added.length > 0 && (
                    <p className="order-last w-full pt-1 text-xs text-bronze">
                      Missing on eCM, added as DNF:{" "}
                      {repairs[i].added.map((d) => `${d.player} (round ${d.round})`).join(", ")}
                    </p>
                  )}
                  <span className="font-medium text-fg">{set.label}</span>
                  <span className="text-fg-muted">{set.map}</span>
                  {a.error ? (
                    <span className="ml-auto text-xs text-danger">cannot be imported: {a.error}</span>
                  ) : (
                    <>
                      <span className="text-xs text-fg-subtle">
                        {a.size}v{a.size} · {set.rounds.length} rounds · {a.ourNames.join(", ")}
                      </span>
                      <select
                        value={targets[i]}
                        onChange={(e) => setTargetEdits((t) => ({ ...t, [i]: e.target.value }))}
                        className={`${selectClass} ml-auto`}
                        aria-label={`Target for ${set.label}`}
                      >
                        <option value="">— skip —</option>
                        {subMatches.map((sm, idx) =>
                          teamSize(sm.format) === a.size ? (
                            <option key={sm.id} value={sm.id}>
                              {idx + 1}. {formatLabel(sm.format)}
                              {sm.rounds.length > 0 ? " (overwrites)" : ""}
                            </option>
                          ) : null
                        )}
                      </select>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {neededNames.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-fg">Assign players</p>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 gap-y-1.5">
                {neededNames.map((name) => (
                  <label key={name} className="flex items-center justify-between gap-2 text-sm text-fg-soft">
                    {name}
                    <select
                      value={playerIdFor(name)}
                      onChange={(e) => setMappingEdits((m) => ({ ...m, [name]: e.target.value }))}
                      className={`${selectClass} w-40 ${playerIdFor(name) ? "" : "border-danger"}`}
                    >
                      <option value="">— pick —</option>
                      <optgroup label="Members">
                        {allPlayers.filter((p) => !p.former && !isGuest(p.tmId)).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </optgroup>
                      {allPlayers.some((p) => !p.former && isGuest(p.tmId)) && (
                        <optgroup label="Guests">
                          {allPlayers.filter((p) => !p.former && isGuest(p.tmId)).map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {canManage && nameDiffs.length > 0 && startDay <= localTodayKey() && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-fg">Differing names</p>
              {nameDiffs.map(({ ecmName, player }) => (
                <p key={ecmName} className="flex flex-wrap items-center gap-x-2 text-xs text-bronze">
                  eCM: {ecmName} · with you in this tournament: {player.name}
                  <button
                    type="button"
                    onClick={() => adoptEcmName(ecmName, player.id)}
                    disabled={renaming === ecmName}
                    className="text-brand-ink hover:underline disabled:opacity-50"
                  >
                    save as the name from the start of the tournament
                  </button>
                </p>
              ))}
            </div>
          )}

          {!canManage && problems.some((p) => p.includes("not all players are assigned")) && (
            <p className="text-xs text-fg-muted">If a player is missing from the list, a manager has to add them first.</p>
          )}
          {problems.map((problem) => (
            <p key={problem} className="text-xs text-danger">{problem}</p>
          ))}
          <ImportCheckPanel check={check} />
          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setText("")}>Back</Button>
            <Button onClick={handleImport} disabled={!canImport}>
              {saving ? "Importing…" : `Import ${selected.filter(Boolean).length} set(s)`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
