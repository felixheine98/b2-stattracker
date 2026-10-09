"use client"

import { EcmBookmarkletSetup } from "@/components/ecm-bookmarklet-setup"
import { BASE_PATH } from "@/lib/base-path"
import { localTodayKey } from "@/lib/player-status"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { repairEcmSet, ECM_PENDING_KEY, normalizeName, parseEcmPayload, type EcmPayload, type EcmSet } from "@/lib/ecm"
import { formatLabel, parseTime, teamSize } from "@/lib/utils"
import { useMemo, useState } from "react"
import type { Player, Round, SubMatch } from "./match-detail-view"

const MAPPING_KEY = "ecm-player-map"

const isDnf = (time: string | undefined) => time?.trim().toUpperCase() === "DNF"
const isEcmUrl = (url: string | undefined) => !!url && /^https:\/\/([a-z0-9-]+\.)*ecircuitmania\.com\//i.test(url)

interface Props {
  subMatches: SubMatch[]
  allPlayers: Player[]
  // Start day of the tournament (YYYY-MM-DD): the day a name taken over from eCM counts from
  startDay: string
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
  if (count === 0) return { size: 0, ourNames: [], error: "keine Runden" }
  if (count % 2 !== 0 || set.rounds.some((r) => r.length !== count)) {
    return { size: 0, ourNames: [], error: "uneinheitliche Spielerzahl pro Runde" }
  }
  const size = count / 2
  const ourNames: string[] = []
  for (const round of set.rounds) {
    const ours = round.filter((e) => isOurs(e.p))
    if (ours.length !== size) return { size, ourNames, error: "Teamzuordnung passt nicht" }
    for (const e of ours) if (!ourNames.includes(e.p)) ourNames.push(e.p)
  }
  if (ourNames.length !== size) return { size, ourNames, error: "wechselnde Spieler innerhalb des Sets" }
  return { size, ourNames }
}

function loadSavedMapping(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAPPING_KEY) ?? "{}")
  } catch {
    return {}
  }
}

export function EcmImportDialog({ subMatches, allPlayers, startDay, isGuest, onClose: close, onImported }: Props) {
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
    if (ids.some((id) => !id)) problems.push(`${payload!.sets[i].label}: nicht alle Spieler zugeordnet`)
    else if (new Set(ids).size !== ids.length) problems.push(`${payload!.sets[i].label}: ein Spieler ist doppelt zugeordnet`)
    if (targets.filter((t, j) => selected[j] && t === targets[i]).length > 1) {
      problems.push(`${payload!.sets[i].label}: Sub-Match mehrfach gewählt`)
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
      setError(data?.error ?? "Name konnte nicht eingetragen werden")
      return
    }
    setRenamed((names) => [...names, ecmName])
    router.refresh()
  }

  const canImport = selected.some(Boolean) && problems.length === 0 && !saving

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
        setError(`${set.label}: ${data?.error ?? "Import fehlgeschlagen"}`)
        setSaving(false)
        return
      }
      const data = await res.json()
      onImported(targets[i], data.rounds, ecmUrl)
    }
    setSaving(false)
    onClose()
  }

  const selectClass =
    "h-8 rounded-md border border-[#3a3435] bg-[#251f20] px-2 text-xs text-[#f5f0f0] focus:outline-none focus:ring-2 focus:ring-[#FBD00D]"

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogTitle>Von eCircuitMania importieren</DialogTitle>

      {!payload ? (
        <div className="space-y-4">
          <p className="text-sm text-[#c5bfbf]">
            Am schnellsten geht es mit dem Lesezeichen: Es liest die Match-Seite auf ecircuitmania.com aus und bringt
            dich mit den Daten direkt hierher.
          </p>
          <EcmBookmarkletSetup />
          <p className="text-xs text-[#5e5858]">
            Nur falls das Lesezeichen ein Fenster zum Kopieren zeigt (sehr großes Match): die kopierten Daten hier einfügen.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="font-mono text-xs"
            placeholder="Kopierte Daten hier einfügen (Strg+V)"
          />
          {text.trim() && <p className="text-sm text-[#ED1F24]">Das sind keine Daten aus dem eCM-Lesezeichen.</p>}
          <div className="dialog-footer flex justify-end">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {payload.teams.length > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#9a9090]">Unser Team</span>
              {payload.teams.map((team, i) => (
                <button
                  key={team.name}
                  type="button"
                  onClick={() => setTeamChoice(i)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    i === ourTeam
                      ? "border-[#FBD00D]/50 bg-[#FBD00D]/10 text-[#f5f0f0]"
                      : "border-[#2d2829] text-[#9a9090] hover:border-[#3a3435]"
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Sets</p>
            {payload.sets.map((set, i) => {
              const a = analyses[i]
              return (
                <div key={i} className="flex flex-wrap items-center gap-x-3 rounded-lg border border-[#2d2829] px-3 py-2 text-sm">
                  {repairs[i].dropped.length > 0 && (
                    <p className="order-last w-full pt-1 text-xs text-[#cd7f32]">
                      Ignoriert, weil überzählig und nie im Ziel:{" "}
                      {repairs[i].dropped.map((d) => `${d.player} (Runde ${d.round})`).join(", ")}
                    </p>
                  )}
                  {repairs[i].added.length > 0 && (
                    <p className="order-last w-full pt-1 text-xs text-[#cd7f32]">
                      Fehlt bei eCM, als DNF ergänzt:{" "}
                      {repairs[i].added.map((d) => `${d.player} (Runde ${d.round})`).join(", ")}
                    </p>
                  )}
                  <span className="font-medium text-[#f5f0f0]">{set.label}</span>
                  <span className="text-[#9a9090]">{set.map}</span>
                  {a.error ? (
                    <span className="ml-auto text-xs text-[#ED1F24]">nicht importierbar: {a.error}</span>
                  ) : (
                    <>
                      <span className="text-xs text-[#5e5858]">
                        {a.size}v{a.size} · {set.rounds.length} Runden · {a.ourNames.join(", ")}
                      </span>
                      <select
                        value={targets[i]}
                        onChange={(e) => setTargetEdits((t) => ({ ...t, [i]: e.target.value }))}
                        className={`${selectClass} ml-auto`}
                        aria-label={`Ziel für ${set.label}`}
                      >
                        <option value="">— überspringen —</option>
                        {subMatches.map((sm, idx) =>
                          teamSize(sm.format) === a.size ? (
                            <option key={sm.id} value={sm.id}>
                              {idx + 1}. {formatLabel(sm.format)}
                              {sm.rounds.length > 0 ? " (überschreibt)" : ""}
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
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Spieler zuordnen</p>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 gap-y-1.5">
                {neededNames.map((name) => (
                  <label key={name} className="flex items-center justify-between gap-2 text-sm text-[#c5bfbf]">
                    {name}
                    <select
                      value={playerIdFor(name)}
                      onChange={(e) => setMappingEdits((m) => ({ ...m, [name]: e.target.value }))}
                      className={`${selectClass} w-40 ${playerIdFor(name) ? "" : "border-[#ED1F24]"}`}
                    >
                      <option value="">— wählen —</option>
                      <optgroup label="Members">
                        {allPlayers.filter((p) => !isGuest(p.tmId)).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </optgroup>
                      {allPlayers.some((p) => isGuest(p.tmId)) && (
                        <optgroup label="Gäste">
                          {allPlayers.filter((p) => isGuest(p.tmId)).map((p) => (
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

          {nameDiffs.length > 0 && startDay <= localTodayKey() && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Abweichende Namen</p>
              {nameDiffs.map(({ ecmName, player }) => (
                <p key={ecmName} className="flex flex-wrap items-center gap-x-2 text-xs text-[#cd7f32]">
                  eCM: {ecmName} · bei euch in dieser Comp: {player.name}
                  <button
                    type="button"
                    onClick={() => adoptEcmName(ecmName, player.id)}
                    disabled={renaming === ecmName}
                    className="text-[#FBD00D] hover:underline disabled:opacity-50"
                  >
                    als Namen ab Comp-Start eintragen
                  </button>
                </p>
              ))}
            </div>
          )}

          {problems.map((problem) => (
            <p key={problem} className="text-xs text-[#ED1F24]">{problem}</p>
          ))}
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}

          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setText("")}>Zurück</Button>
            <Button onClick={handleImport} disabled={!canImport}>
              {saving ? "Importiert…" : `${selected.filter(Boolean).length} Set(s) importieren`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
