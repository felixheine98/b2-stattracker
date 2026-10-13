"use client"

import { GuestBadge } from "@/components/guest-badge"
import { TrialBadge } from "@/components/trial-badge"
import { PlayerAvatar } from "@/components/player-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { countryName } from "@/lib/countries"
import { confirmedTmId } from "@/lib/opponents"
import { formatGapSeconds } from "@/lib/pace"
import { PacePct } from "@/components/pace-pct"
import { allNames, type NameChange } from "@/lib/player-names"
import type { CompProfile, MapLine, RankedPace, StatLine } from "@/lib/player-profile"
import { currentStatus, formatDay, type PlayerStatus, type StatusChange } from "@/lib/player-status"
import { useSyncedState } from "@/lib/use-synced-state"
import { BASE_PATH } from "@/lib/base-path"
import { INACTIVE_LABEL } from "@/lib/planning"
import { cn, formatLabel, formatTime } from "@/lib/utils"
import { styleLabel } from "@/lib/comp-styles"
import type { CompStyle, Format } from "@prisma/client"
import { ArrowLeft, ArrowLeftRight, ChevronDown, ChevronUp, ExternalLink, History, Moon, Pencil, Swords, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { NameHistoryDialog } from "../name-history-dialog"
import { StatusHistoryDialog, StatusMoveDialog, type StatusPlayer } from "../status-dialogs"

interface Player extends StatusPlayer {
  // Does not drive competitions as a rule; counts as "Inactive" in the lineup planning
  inactive: boolean
  tmId: string
  country: string | null
  initialName: string
  nameChanges: NameChange[]
}

type FormatLine = StatLine & { format: Format }
type StyleLine = StatLine & { style: CompStyle }

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
    paceMs: number | null
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
  styles: StyleLine[]
  comps: CompView[]
  // The player also drove against us; those rounds are on the opponent profile
  hasOpponentProfile: boolean
  canManage: boolean
  endurance: React.ReactNode
  hasEndurance: boolean
}

const STATUS_TEXT: Record<PlayerStatus, string> = { MEMBER: "Member", TRIAL: "Trial", GUEST: "Guest", FORMER: "Former" }

const rankLabel = (rank: number | null, of: number) => (rank === null ? "—" : `${rank} of ${of}`)
const avgPlace = (line: StatLine) => (line.roundsPlayed > 0 ? (line.placementSum / line.roundsPlayed).toFixed(3) : "—")

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
    </div>
  )
}

const paceHint = (pace: RankedPace) =>
  pace.value === null ? "no timed round" : <>Team <PacePct pct={pace.team} ms={pace.teamMs} /> · {rankLabel(pace.rank, pace.of)}</>

const TH = "px-3 py-2 text-right font-medium whitespace-nowrap text-fg-muted"
const TD = "px-3 py-1.5 text-right whitespace-nowrap text-fg-soft"
const FIRST_TH = "sticky left-0 z-[1] bg-table-head py-2 pl-3 pr-4 text-left font-medium whitespace-nowrap text-fg-muted"
const FIRST_TD = "sticky left-0 z-[1] bg-table-cell py-1.5 pl-3 pr-4 text-left font-medium whitespace-nowrap text-fg max-md:shadow-[1px_0_0_var(--border)]"

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-xs bg-table-row">{children}</table>
    </div>
  )
}

const formatRows = (formats: FormatLine[]) => formats.map((f) => ({ ...f, label: formatLabel(f.format) }))

// One row per format (the placement only means something within a format) or per style
function StatTable({ heading, rows }: { heading: string; rows: Array<StatLine & { label: string }> }) {
  if (rows.length === 0) return <p className="text-xs text-fg-subtle">No rounds counted yet.</p>
  return (
    <Table>
      <thead>
        <tr className="border-b border-line bg-table-head">
          <th className={FIRST_TH}>{heading}</th>
          {["Played", "Avg place", "Pace", "Team", "Rank", "DNF", "Round W", "Round L"].map((h) => <th key={h} className={TH}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((f) => (
          <tr key={f.label} className="border-b border-table-rule last:border-0">
            <td className={FIRST_TD}>{f.label}</td>
            <td className={TD}>{f.roundsPlayed}</td>
            <td className={cn(TD, "font-mono")}>{avgPlace(f)}</td>
            <td className={cn(TD, "font-mono text-fg")}><PacePct pct={f.pace.value} ms={f.pace.valueMs} /></td>
            <td className={cn(TD, "font-mono")}><PacePct pct={f.pace.team} ms={f.pace.teamMs} /></td>
            <td className={TD}>{rankLabel(f.pace.rank, f.pace.of)}</td>
            <td className={TD}>{f.dnfs}</td>
            <td className={cn(TD, "text-fg")}>{f.roundsWon}</td>
            <td className={cn(TD, "text-fg")}>{f.roundsLost}</td>
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
        <tr className="border-b border-line bg-table-head">
          <th className={FIRST_TH}>Map</th>
          {["PB", "Rank", "Gap", "Rounds", "Avg gap", "Rank"].map((h, i) => <th key={i} className={TH}>{h}</th>)}
          <th className={cn(TH, "text-left")}>PB driven in</th>
        </tr>
      </thead>
      <tbody>
        {maps.map((m) => (
          <tr key={m.track} className="border-b border-table-rule last:border-0">
            <td className={FIRST_TD}>{m.track}</td>
            <td className={cn(TD, "font-mono text-brand-ink")}>{m.pbMs === null ? "—" : formatTime(m.pbMs)}</td>
            <td className={TD}>{rankLabel(m.pbRank, m.pbOf)}</td>
            <td className={cn(TD, "font-mono")}>{formatGapSeconds(m.pbGapMs)}</td>
            <td className={TD}>{m.rounds}</td>
            <td className={cn(TD, "font-mono text-fg")}>{formatGapSeconds(m.avgGapMs)}</td>
            <td className={TD}>{rankLabel(m.avgGapRank, m.avgGapOf)}</td>
            <td className={cn(TD, "text-left")}>
              {m.pbMatchPath ? <Link href={m.pbMatchPath} className="text-brand-ink hover:underline">Match →</Link> : "—"}
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
        <tr className="border-b border-line bg-table-head">
          <th className={FIRST_TH}>Match</th>
          <th className={cn(TH, "text-left")}>Stage</th>
          <th className={cn(TH, "text-left")}>Lineup</th>
          <th className={cn(TH, "text-left")}>Date</th>
          <th className={TH}>Rounds</th>
          <th className={TH}>Pace</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((m) => (
          <tr key={m.matchId} className="border-b border-table-rule last:border-0">
            <td className={FIRST_TD}>
              <Link href={m.path} className="hover:text-brand-ink hover:underline">vs {m.opponent ?? "Unknown"}</Link>
            </td>
            <td className={cn(TD, "text-left")}>{m.stage}</td>
            <td className={cn(TD, "text-left")}>{m.lineupName}</td>
            <td className={cn(TD, "text-left")}>{m.day ? formatDay(m.day) : "—"}</td>
            <td className={TD}>{m.roundsPlayed}</td>
            <td className={cn(TD, "font-mono text-fg")}><PacePct pct={m.pace} ms={m.paceMs} /></td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function CompCard({ comp, initiallyOpen }: { comp: CompView; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-raised/50"
      >
        <Trophy size={16} className="mt-1 shrink-0 text-brand-ink" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words font-semibold text-fg">{comp.name}</span>
            {comp.status === "TRIAL" ? <TrialBadge /> : comp.status === "MEMBER" ? <span className="text-xs text-fg-muted">Member</span> : <GuestBadge />}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-muted">
            {comp.day && <span>{formatDay(comp.day)}</span>}
            <span>{comp.lineups.map((l) => l.name).join(", ") || "no lineup"}</span>
            {comp.deployed ? (
              <>
                <span>{comp.total.roundsPlayed} rounds</span>
                <span className="font-mono text-fg-soft">Pace <PacePct pct={comp.total.pace.value} ms={comp.total.pace.valueMs} /></span>
              </>
            ) : (
              <span className="text-bronze">not fielded</span>
            )}
          </span>
        </span>
        {open ? <ChevronUp size={16} className="mt-1 shrink-0 text-fg-subtle" /> : <ChevronDown size={16} className="mt-1 shrink-0 text-fg-subtle" />}
      </button>

      {open && (
        <div className="space-y-5 border-t border-line bg-canvas p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href={comp.path} className="text-brand-ink hover:underline">To the tournament →</Link>
            {comp.lineups.map((l) => (
              <Link key={l.id} href={l.path} className="text-fg-soft hover:text-fg hover:underline">{l.name} →</Link>
            ))}
          </div>
          {!comp.deployed && <p className="text-xs text-fg-subtle">In the roster, but without a recorded round.</p>}
          {comp.total.roundsPlayed > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-fg">Stats</h3>
              <p className="text-xs text-fg-subtle">
                Pace <PacePct pct={comp.total.pace.value} ms={comp.total.pace.valueMs} /> · {paceHint(comp.total.pace)}
              </p>
              <StatTable heading="Format" rows={formatRows(comp.formats)} />
            </section>
          )}
          {comp.maps.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-fg">Maps</h3>
              <p className="text-xs text-fg-subtle">
                PB compared with the bests of our drivers. Avg gap to the fastest time of each round, both teams.
              </p>
              <MapTable maps={comp.maps} />
            </section>
          )}
          {comp.matches.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-fg">Matches</h3>
              <MatchTable matches={comp.matches} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export function PlayerProfileView({ player: initial, total, formats, styles, comps, hasOpponentProfile, canManage, endurance, hasEndurance }: Props) {
  const router = useRouter()
  const [player, setPlayer] = useSyncedState(initial)
  const [dialog, setDialog] = useState<"name" | "move" | "history" | null>(null)

  const status = currentStatus(player)
  const formerNames = allNames(player).filter((n) => n !== player.name)
  const tmId = confirmedTmId(player.tmId)
  const dnfRate = total.roundsPlayed > 0 ? (total.dnfs / total.roundsPlayed) * 100 : null
  const decided = total.roundsWon + total.roundsLost

  // Inactive: a member who is not asked for an answer in the lineup planning
  async function toggleInactive() {
    const inactive = !player.inactive
    const res = await fetch(`${BASE_PATH}/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inactive }),
    }).catch(() => null)
    if (!res?.ok) return
    setPlayer((p) => ({ ...p, inactive }))
    router.refresh()
  }

  function setStatusChanges(statusChanges: StatusChange[], loginDeleted?: boolean) {
    setPlayer((p) => ({ ...p, statusChanges, ...(loginDeleted && { user: null }) }))
    router.refresh()
  }

  return (
    <div className="page-wide space-y-6">
      <Link href="/players" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft size={14} />
        Players
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PlayerAvatar player={player} className="h-8 w-8 text-base" />
            <h1 className="break-words text-2xl font-bold text-fg">{player.name}</h1>
            <Badge variant={status === "MEMBER" ? "primary" : status === "TRIAL" ? "secondary" : "default"}>{STATUS_TEXT[status]}</Badge>
            {player.inactive && <Badge variant="purple" title="Does not drive competitions as a rule">{INACTIVE_LABEL}</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
            {player.country && <span>{countryName(player.country)}</span>}
            {formerNames.length > 0 && <span>formerly: {formerNames.join(", ")}</span>}
            {tmId && (
              <a href={`https://trackmania.io/#/player/${tmId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-ink hover:underline">
                Trackmania.io
                <ExternalLink size={12} />
              </a>
            )}
            {hasOpponentProfile && (
              <Link href={`/opponents/players/${player.id}`} className="inline-flex items-center gap-1 text-brand-ink hover:underline">
                <Swords size={12} />
                Rounds against us
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog("name")}>
            <Pencil size={13} />
            {canManage ? "Name" : "Name history"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog("history")}>
            <History size={13} />
            Status history
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" onClick={toggleInactive} title="Inactive members are not asked for an answer in the lineup planning">
              <Moon size={13} />
              {player.inactive ? "Set active" : "Set inactive"}
            </Button>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setDialog("move")}>
              <ArrowLeftRight size={13} />
              {status === "TRIAL" ? "To members" : "Change status"}
            </Button>
          )}
        </div>
      </div>

      {/* From 1536px on the tournaments stand on the right, everything over the whole career on the left */}
      <div className="page-columns-even">
      {comps.length === 0 ? (
        !hasEndurance &&
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-fg-muted">
          Not part of a tournament yet and no recorded rounds.
        </p>
      ) : (
        <>
          <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-fg">Overall</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-3 min-[1800px]:grid-cols-5">
              <Tile label="Comps" value={comps.length} />
              <Tile label="Rounds" value={total.roundsPlayed} />
              <Tile label="Pace" value={<PacePct pct={total.pace.value} ms={total.pace.valueMs} />} hint={paceHint(total.pace)} />
              <Tile label="DNF rate" value={dnfRate === null ? "—" : `${dnfRate.toFixed(1)} %`} hint={`${total.dnfs} DNF`} />
              <Tile
                label="Round W/L"
                value={`${total.roundsWon}–${total.roundsLost}`}
                hint={decided > 0 ? `${((total.roundsWon / decided) * 100).toFixed(0)} % won` : undefined}
              />
            </div>
            <p className="text-xs text-fg-subtle">
              Pace: average gap to the fastest time of the round (both teams), without DNFs. Seeding does not count.
            </p>
            <StatTable heading="Format" rows={formatRows(formats)} />
          </section>

          {styles.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">By style</h2>
              <p className="text-xs text-fg-subtle">The same over all tournaments of a style.{hasEndurance ? " Endurance races are listed on their own below." : ""}</p>
              <StatTable heading="Style" rows={styles.map((s) => ({ ...s, label: styleLabel(s.style) }))} />
            </section>
          )}
          </div>

          <section className="page-main space-y-3">
            <h2 className="text-lg font-semibold text-fg">Tournaments</h2>
            {comps.map((comp, i) => <CompCard key={comp.tournamentId} comp={comp} initiallyOpen={i === 0} />)}
          </section>
        </>
      )}

      {endurance}
      </div>

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
