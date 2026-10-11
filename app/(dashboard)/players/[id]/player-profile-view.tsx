"use client"

import { GuestBadge } from "@/components/guest-badge"
import { TrialBadge } from "@/components/trial-badge"
import { PlayerAvatar } from "@/components/player-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { countryName } from "@/lib/countries"
import { confirmedTmId } from "@/lib/opponents"
import { formatGapSeconds, formatPacePct } from "@/lib/pace"
import { allNames, type NameChange } from "@/lib/player-names"
import type { CompProfile, MapLine, RankedPace, StatLine } from "@/lib/player-profile"
import { currentStatus, formatDay, type PlayerStatus, type StatusChange } from "@/lib/player-status"
import { useSyncedState } from "@/lib/use-synced-state"
import { cn, formatLabel, formatTime } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { ArrowLeft, ArrowLeftRight, ChevronDown, ChevronUp, ExternalLink, History, Pencil, Swords, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { NameHistoryDialog } from "../name-history-dialog"
import { StatusHistoryDialog, StatusMoveDialog, type StatusPlayer } from "../status-dialogs"

interface Player extends StatusPlayer {
  tmId: string
  country: string | null
  initialName: string
  nameChanges: NameChange[]
}

type FormatLine = StatLine & { format: Format }

// A tournament of the profile with everything needed to show and link it
export interface CompView extends Omit<CompProfile, "maps" | "matches"> {
  name: string
  path: string
  day: string | null
  // Member or guest as of the tournament's start day
  status: PlayerStatus
  lineups: Array<{ id: string; name: string; path: string }>
  maps: Array<MapLine & { pbMatchPath: string | null }>
  matches: Array<{
    matchId: string
    roundsPlayed: number
    pace: number | null
    path: string
    day: string | null
    stage: string
    opponent: string | null
    lineupName: string
  }>
}

interface Props {
  player: Player
  total: StatLine
  formats: FormatLine[]
  comps: CompView[]
  // The player also drove against us; those rounds are on the opponent profile
  hasOpponentProfile: boolean
  canManage: boolean
}

const STATUS_TEXT: Record<PlayerStatus, string> = { MEMBER: "Member", TRIAL: "Trial", GUEST: "Gast", FORMER: "Ehemalig" }

const rankLabel = (rank: number | null, of: number) => (rank === null ? "—" : `${rank}. von ${of}`)
const avgPlace = (line: StatLine) => (line.roundsPlayed > 0 ? (line.placementSum / line.roundsPlayed).toFixed(3) : "—")

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2d2829] bg-[#1c1819] px-4 py-3">
      <p className="text-xs text-[#9a9090]">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold text-[#f5f0f0]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#5e5858]">{hint}</p>}
    </div>
  )
}

const paceHint = (pace: RankedPace) =>
  pace.value === null ? "keine gewertete Runde" : `Team ${formatPacePct(pace.team)} · ${rankLabel(pace.rank, pace.of)}`

const TH = "px-3 py-2 text-right font-medium whitespace-nowrap text-[#9a9090]"
const TD = "px-3 py-1.5 text-right whitespace-nowrap text-[#c5bfbf]"
const FIRST_TH = "sticky left-0 z-[1] bg-[#1c1819] py-2 pl-3 pr-4 text-left font-medium whitespace-nowrap text-[#9a9090]"
const FIRST_TD = "sticky left-0 z-[1] bg-[#0e0b0b] py-1.5 pl-3 pr-4 text-left font-medium whitespace-nowrap text-[#f5f0f0] max-md:shadow-[1px_0_0_#2d2829]"

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#2d2829]">
      <table className="w-full text-xs">{children}</table>
    </div>
  )
}

// One row per format: the placement only means something within a format
function FormatTable({ formats }: { formats: FormatLine[] }) {
  if (formats.length === 0) return <p className="text-xs text-[#5e5858]">Noch keine gewerteten Runden.</p>
  return (
    <Table>
      <thead>
        <tr className="border-b border-[#2d2829] bg-[#1c1819]">
          <th className={FIRST_TH}>Format</th>
          {["Gespielt", "Ø Platz", "Pace", "Team", "Rang", "DNF", "Round W", "Round L"].map((h) => <th key={h} className={TH}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {formats.map((f) => (
          <tr key={f.format} className="border-b border-[#1c1819] last:border-0">
            <td className={FIRST_TD}>{formatLabel(f.format)}</td>
            <td className={TD}>{f.roundsPlayed}</td>
            <td className={cn(TD, "font-mono")}>{avgPlace(f)}</td>
            <td className={cn(TD, "font-mono text-[#f5f0f0]")}>{formatPacePct(f.pace.value)}</td>
            <td className={cn(TD, "font-mono")}>{formatPacePct(f.pace.team)}</td>
            <td className={TD}>{rankLabel(f.pace.rank, f.pace.of)}</td>
            <td className={TD}>{f.dnfs}</td>
            <td className={cn(TD, "text-[#f5f0f0]")}>{f.roundsWon}</td>
            <td className={cn(TD, "text-[#f5f0f0]")}>{f.roundsLost}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function MapTable({ maps }: { maps: CompView["maps"] }) {
  return (
    <Table>
      <thead>
        <tr className="border-b border-[#2d2829] bg-[#1c1819]">
          <th className={FIRST_TH}>Map</th>
          {["PB", "Rang", "Rückstand", "Runden", "Ø Rückstand", "Rang"].map((h, i) => <th key={i} className={TH}>{h}</th>)}
          <th className={cn(TH, "text-left")}>PB gefahren</th>
        </tr>
      </thead>
      <tbody>
        {maps.map((m) => (
          <tr key={m.track} className="border-b border-[#1c1819] last:border-0">
            <td className={FIRST_TD}>{m.track}</td>
            <td className={cn(TD, "font-mono text-[#FBD00D]")}>{m.pbMs === null ? "—" : formatTime(m.pbMs)}</td>
            <td className={TD}>{rankLabel(m.pbRank, m.pbOf)}</td>
            <td className={cn(TD, "font-mono")}>{formatGapSeconds(m.pbGapMs)}</td>
            <td className={TD}>{m.rounds}</td>
            <td className={cn(TD, "font-mono text-[#f5f0f0]")}>{formatGapSeconds(m.avgGapMs)}</td>
            <td className={TD}>{rankLabel(m.avgGapRank, m.avgGapOf)}</td>
            <td className={cn(TD, "text-left")}>
              {m.pbMatchPath ? <Link href={m.pbMatchPath} className="text-[#FBD00D] hover:underline">Match →</Link> : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function MatchTable({ matches }: { matches: CompView["matches"] }) {
  return (
    <Table>
      <thead>
        <tr className="border-b border-[#2d2829] bg-[#1c1819]">
          <th className={FIRST_TH}>Match</th>
          <th className={cn(TH, "text-left")}>Abschnitt</th>
          <th className={cn(TH, "text-left")}>Lineup</th>
          <th className={cn(TH, "text-left")}>Datum</th>
          <th className={TH}>Runden</th>
          <th className={TH}>Pace</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((m) => (
          <tr key={m.matchId} className="border-b border-[#1c1819] last:border-0">
            <td className={FIRST_TD}>
              <Link href={m.path} className="hover:text-[#FBD00D] hover:underline">vs {m.opponent ?? "Unbekannt"}</Link>
            </td>
            <td className={cn(TD, "text-left")}>{m.stage}</td>
            <td className={cn(TD, "text-left")}>{m.lineupName}</td>
            <td className={cn(TD, "text-left")}>{m.day ? formatDay(m.day) : "—"}</td>
            <td className={TD}>{m.roundsPlayed}</td>
            <td className={cn(TD, "font-mono text-[#f5f0f0]")}>{formatPacePct(m.pace)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function CompCard({ comp, initiallyOpen }: { comp: CompView; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div className="overflow-hidden rounded-xl border border-[#2d2829] bg-[#1c1819]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-[#251f20]/50"
      >
        <Trophy size={16} className="mt-1 shrink-0 text-[#FBD00D]" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words font-semibold text-[#f5f0f0]">{comp.name}</span>
            {comp.status === "TRIAL" ? <TrialBadge /> : comp.status === "MEMBER" ? <span className="text-xs text-[#9a9090]">Member</span> : <GuestBadge />}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#9a9090]">
            {comp.day && <span>{formatDay(comp.day)}</span>}
            <span>{comp.lineups.map((l) => l.name).join(", ") || "ohne Lineup"}</span>
            {comp.deployed ? (
              <>
                <span>{comp.total.roundsPlayed} Runden</span>
                <span className="font-mono text-[#c5bfbf]">Pace {formatPacePct(comp.total.pace.value)}</span>
              </>
            ) : (
              <span className="text-[#cd7f32]">nicht eingesetzt</span>
            )}
          </span>
        </span>
        {open ? <ChevronUp size={16} className="mt-1 shrink-0 text-[#5e5858]" /> : <ChevronDown size={16} className="mt-1 shrink-0 text-[#5e5858]" />}
      </button>

      {open && (
        <div className="space-y-5 border-t border-[#2d2829] bg-[#0e0c0d] p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href={comp.path} className="text-[#FBD00D] hover:underline">Zum Turnier →</Link>
            {comp.lineups.map((l) => (
              <Link key={l.id} href={l.path} className="text-[#c5bfbf] hover:text-[#f5f0f0] hover:underline">{l.name} →</Link>
            ))}
          </div>
          {!comp.deployed && <p className="text-xs text-[#5e5858]">Im Kader, aber ohne erfasste Runde.</p>}
          {comp.total.roundsPlayed > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[#f5f0f0]">Stats</h3>
              <p className="text-xs text-[#5e5858]">
                Pace {formatPacePct(comp.total.pace.value)} · {paceHint(comp.total.pace)}
              </p>
              <FormatTable formats={comp.formats} />
            </section>
          )}
          {comp.maps.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[#f5f0f0]">Maps</h3>
              <p className="text-xs text-[#5e5858]">
                PB im Vergleich zu den Bestzeiten unserer Fahrer. Ø Rückstand auf die schnellste Zeit der jeweiligen Runde, beide Teams.
              </p>
              <MapTable maps={comp.maps} />
            </section>
          )}
          {comp.matches.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[#f5f0f0]">Matches</h3>
              <MatchTable matches={comp.matches} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export function PlayerProfileView({ player: initial, total, formats, comps, hasOpponentProfile, canManage }: Props) {
  const router = useRouter()
  const [player, setPlayer] = useSyncedState(initial)
  const [dialog, setDialog] = useState<"name" | "move" | "history" | null>(null)

  const status = currentStatus(player)
  const formerNames = allNames(player).filter((n) => n !== player.name)
  const tmId = confirmedTmId(player.tmId)
  const dnfRate = total.roundsPlayed > 0 ? (total.dnfs / total.roundsPlayed) * 100 : null
  const decided = total.roundsWon + total.roundsLost

  function setStatusChanges(statusChanges: StatusChange[], loginDeleted?: boolean) {
    setPlayer((p) => ({ ...p, statusChanges, ...(loginDeleted && { user: null }) }))
    router.refresh()
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/players" className="inline-flex items-center gap-1.5 text-sm text-[#9a9090] hover:text-[#f5f0f0]">
        <ArrowLeft size={14} />
        Players
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PlayerAvatar player={player} className="h-8 w-8 text-base" />
            <h1 className="break-words text-2xl font-bold text-[#f5f0f0]">{player.name}</h1>
            <Badge variant={status === "MEMBER" ? "primary" : status === "TRIAL" ? "secondary" : "default"}>{STATUS_TEXT[status]}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#9a9090]">
            {player.country && <span>{countryName(player.country)}</span>}
            {formerNames.length > 0 && <span>früher: {formerNames.join(", ")}</span>}
            {tmId && (
              <a href={`https://trackmania.io/#/player/${tmId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#FBD00D] hover:underline">
                Trackmania.io
                <ExternalLink size={12} />
              </a>
            )}
            {hasOpponentProfile && (
              <Link href={`/opponents/players/${player.id}`} className="inline-flex items-center gap-1 text-[#FBD00D] hover:underline">
                <Swords size={12} />
                Einsätze gegen uns
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog("name")}>
            <Pencil size={13} />
            {canManage ? "Name" : "Namensverlauf"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog("history")}>
            <History size={13} />
            Statusverlauf
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setDialog("move")}>
              <ArrowLeftRight size={13} />
              {status === "TRIAL" ? "Zu Membern" : "Status ändern"}
            </Button>
          )}
        </div>
      </div>

      {comps.length === 0 ? (
        <p className="rounded-xl border border-[#2d2829] bg-[#1c1819] p-5 text-sm text-[#9a9090]">
          Noch in keinem Turnier dabei und keine erfassten Runden.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[#f5f0f0]">Gesamt</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Tile label="Comps" value={comps.length} />
              <Tile label="Runden" value={total.roundsPlayed} />
              <Tile label="Pace" value={formatPacePct(total.pace.value)} hint={paceHint(total.pace)} />
              <Tile label="DNF-Quote" value={dnfRate === null ? "—" : `${dnfRate.toFixed(1)} %`} hint={`${total.dnfs} DNF`} />
              <Tile
                label="Round W/L"
                value={`${total.roundsWon}–${total.roundsLost}`}
                hint={decided > 0 ? `${((total.roundsWon / decided) * 100).toFixed(0)} % gewonnen` : undefined}
              />
            </div>
            <p className="text-xs text-[#5e5858]">
              Pace: Ø Rückstand auf die schnellste Zeit der Runde (beide Teams), ohne DNFs. Seeding zählt nicht mit.
            </p>
            <FormatTable formats={formats} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[#f5f0f0]">Turniere</h2>
            {comps.map((comp, i) => <CompCard key={comp.tournamentId} comp={comp} initiallyOpen={i === 0} />)}
          </section>
        </>
      )}

      {dialog === "name" && (
        <NameHistoryDialog
          player={player}
          canManage={canManage}
          onClose={() => setDialog(null)}
          onChanged={(history) => {
            setPlayer((p) => ({ ...p, ...history }))
            // A new name is a new address; the old one redirects to it
            router.refresh()
          }}
        />
      )}
      {dialog === "history" && (
        <StatusHistoryDialog player={player} canManage={canManage} onClose={() => setDialog(null)} onChanged={setStatusChanges} />
      )}
      {dialog === "move" && canManage && (
        <StatusMoveDialog player={player} onClose={() => setDialog(null)} onChanged={setStatusChanges} />
      )}
    </div>
  )
}
