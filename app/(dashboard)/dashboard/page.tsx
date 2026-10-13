import { AvailabilityCard } from "@/components/planning/availability-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { bestPerformer, dashboardTournaments, latestStageId, lineupRecords, overallRecord, type LineupRecord, type Performer } from "@/lib/dashboard"
import { styleLabel } from "@/lib/comp-styles"
import { db } from "@/lib/db"
import { matchTag } from "@/lib/match-order"
import { formatGapSeconds, formatPacePct } from "@/lib/pace"
import { lineupPath, matchPath, playerPath, tournamentPath } from "@/lib/paths"
import { openPlanningsFor } from "@/lib/planning-db"
import { buildProfile } from "@/lib/player-profile"
import { currentStatus, formatDay } from "@/lib/player-status"
import { sortStages, stageName } from "@/lib/stages"
import { cn, formatLabel } from "@/lib/utils"
import { ChevronRight, Star, Swords, Trophy, Users } from "lucide-react"
import Link from "next/link"

const HEADING = "text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3"

function Tile({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="flex items-center justify-between text-xs text-fg-muted">
        {label}
        {icon}
      </p>
      <p className="mt-0.5 font-mono text-xl font-semibold text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
    </div>
  )
}

const winRate = (won: number, lost: number) => (won + lost > 0 ? `${Math.round((won / (won + lost)) * 100)} %` : "—")
const OUTCOME: Record<string, { label: string; className: string }> = {
  W: { label: "W", className: "text-brand-ink" },
  L: { label: "L", className: "text-danger" },
  D: { label: "D", className: "text-fg-muted" },
}

export default async function DashboardPage() {
  const session = await auth()
  const userId = (session?.user as { id?: string })?.id

  const [self, players, tournaments, recent, matches] = await Promise.all([
    userId ? db.user.findUnique({ where: { id: userId }, select: { playerId: true } }) : null,
    db.player.findMany({ where: { isOpponentOnly: false }, select: { id: true, slug: true, tmId: true, name: true, initialStatus: true, statusChanges: true } }),
    db.tournament.findMany({
      where: { tfhRace: { is: null } },
      select: {
        id: true, slug: true, name: true, style: true, startDate: true, endDate: true, createdAt: true,
        stages: { select: { id: true, type: true, number: true } },
        tournamentLineups: { orderBy: { createdAt: "asc" }, select: { id: true, slug: true, name: true, slots: { select: { playerId: true } } } },
      },
    }),
    // The top of the list of all tournaments, whatever their kind
    db.tournament.findMany({
      orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 3,
      select: { id: true, slug: true, name: true, style: true, startDate: true },
    }),
    // Every match with its rounds: the records count them all, pace and ranks need every driver
    db.match.findMany({
      where: { tournamentLineupId: { not: null } },
      select: {
        id: true, slug: true, date: true, createdAt: true, opponent: true, number: true, label: true, closedAt: true, confirmedOutcome: true,
        tournamentId: true, tournamentLineupId: true,
        stage: { select: { id: true, type: true, number: true } },
        subMatches: {
          orderBy: { order: "asc" },
          select: {
            format: true,
            rounds: {
              orderBy: { number: "asc" },
              select: {
                track: true,
                results: {
                  orderBy: [{ position: "asc" }, { timeMs: "asc" }],
                  select: { id: true, tmId: true, playerName: true, playerId: true, isOurTeam: true, dnf: true, timeMs: true },
                },
              },
            },
          },
        },
      },
    }),
  ])

  // Tournaments being planned that still want an answer from the signed-in player
  const planningCards = self?.playerId ? await openPlanningsFor(self.playerId) : []

  // Guests are stand-ins and do not count as team members
  const memberCount = players.filter((p) => currentStatus(p) === "MEMBER").length
  const overall = overallRecord(matches)
  const playerByTmId = new Map(players.map((p) => [p.tmId.toLowerCase(), p]))

  const shown = dashboardTournaments(tournaments.map((t) => ({ ...t, lineupCount: t.tournamentLineups.length })), new Date())
  const blocks = [
    ...shown.current.map((tournament) => ({ tournament, heading: "Current Tournament" })),
    ...(shown.last ? [{ tournament: shown.last, heading: "Last Tournament" }] : []),
  ]

  return (
    <div className="space-y-6 page-wide">
      <div>
        <h1 className="text-2xl font-bold text-fg">Welcome back, {session?.user?.name}</h1>
        <p className="text-fg-muted text-sm mt-0.5">Here is how the team is doing.</p>
      </div>

      {/* From 1536px on the tournaments stand on the left, the rest on the right */}
      <div className="page-columns">
      {planningCards.length > 0 && (
        <div>
          <h2 className={HEADING}>Next Tournament{planningCards.length > 1 ? "s" : ""}</h2>
          <div className="space-y-3">
            {planningCards.map((card) => (
              <AvailabilityCard key={card.tournament.id} {...card} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className={HEADING}>Overall</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-2">
          <Tile label="Members" value={memberCount} icon={<Users size={15} className="text-brand-ink" />} />
          <Tile label="Round tournaments" value={tournaments.length} icon={<Trophy size={15} className="text-brand-ink" />} />
          <Tile
            label="Matches"
            value={matches.length}
            hint={`${overall.matchesWon} W · ${overall.matchesDrawn} D · ${overall.matchesLost} L`}
            icon={<Swords size={15} className="text-brand-ink" />}
          />
          <Tile label="Round win rate" value={winRate(overall.roundsWon, overall.roundsLost)} hint={`${overall.roundsWon} W – ${overall.roundsLost} L`} />
        </div>
      </div>

      <div className="page-main space-y-6">
      {blocks.map(({ tournament, heading }) => {
        const own = matches.filter((m) => m.tournamentId === tournament.id)
        const stages = sortStages(tournament.stages)
        const lineups = tournament.tournamentLineups
        const records = lineupRecords(own, lineups.map((l) => l.id))
        const ownLineupId = self?.playerId ? lineups.find((l) => l.slots.some((s) => s.playerId === self.playerId))?.id : undefined

        const stageId = latestStageId(own, stages.map((s) => s.id))
        const lastStage = stages.find((s) => s.id === stageId)
        const performers: Array<{ title: string; performer: Performer | null }> = [
          { title: "Best performer of the tournament", performer: bestPerformer(own) },
          ...(lastStage ? [{ title: `Best performer · ${stageName(lastStage, stages)}`, performer: bestPerformer(own.filter((m) => m.stage.id === stageId)) }] : []),
        ]

        // The signed-in player's own numbers in this tournament, as on their profile
        const comp = self?.playerId
          ? buildProfile(self.playerId, [{ id: tournament.id, style: tournament.style, lineups: lineups.map((l) => ({ id: l.id, playerIds: l.slots.map((s) => s.playerId) })) }], own).comps[0]
          : undefined
        const mine = comp && comp.total.roundsPlayed > 0 ? comp : null
        const bestMap = mine?.maps.filter((m) => m.avgGapMs !== null).sort((a, b) => a.avgGapMs! - b.avgGapMs!)[0]
        const selfPlayer = players.find((p) => p.id === self?.playerId)

        const lastMatchOf = (record: LineupRecord) => {
          const match = record.lastMatch && own.find((m) => m.id === record.lastMatch!.id)
          const lineup = lineups.find((l) => l.id === record.lineupId)
          return match && lineup ? { match, path: matchPath(tournament, lineup, match) } : null
        }

        return (
          <section key={tournament.id}>
            <h2 className={HEADING}>{heading}</h2>
            <Card>
              <CardContent className="space-y-5 pt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link href={tournamentPath(tournament)} className="flex items-center gap-2 text-lg font-semibold text-fg hover:text-brand-ink">
                    <Trophy size={17} className="shrink-0 text-brand-ink" />
                    <span className="break-words">{tournament.name}</span>
                  </Link>
                  <span className="text-xs text-fg-muted">
                    {tournament.startDate ? formatDay(tournament.startDate) : ""}
                    {tournament.endDate ? ` – ${formatDay(tournament.endDate)}` : ""}
                  </span>
                </div>

                {/* One row per lineup; on phones each row stacks into a small card */}
                <div className="overflow-hidden rounded-lg border border-line">
                  <div className="hidden grid-cols-[minmax(0,1.5fr)_repeat(3,5.5rem)_minmax(0,1.6fr)] gap-3 border-b border-line bg-raised px-3 py-2 text-xs font-medium text-fg-muted md:grid">
                    <span>Lineup</span>
                    <span className="text-right">Matches</span>
                    <span className="text-right">Maps</span>
                    <span className="text-right">Rounds</span>
                    <span>Last match</span>
                  </div>
                  {records.map((record) => {
                    const lineup = lineups.find((l) => l.id === record.lineupId)!
                    const last = lastMatchOf(record)
                    const outcome = record.lastMatch?.outcome ? OUTCOME[record.lastMatch.outcome] : null
                    return (
                      <div
                        key={record.lineupId}
                        className={cn(
                          "grid grid-cols-3 gap-x-3 gap-y-1.5 border-b border-line px-3 py-2.5 text-sm last:border-0 md:grid-cols-[minmax(0,1.5fr)_repeat(3,5.5rem)_minmax(0,1.6fr)] md:items-center",
                          record.lineupId === ownLineupId && "bg-brand/5"
                        )}
                      >
                        <span className="col-span-3 flex min-w-0 items-center gap-2 md:col-span-1">
                          <Link href={lineupPath(tournament, lineup)} className="truncate font-medium text-fg hover:text-brand-ink">{lineup.name}</Link>
                          {record.lineupId === ownLineupId && <span className="shrink-0 text-xs text-brand-ink">your lineup</span>}
                        </span>
                        <span className="font-mono text-fg md:text-right">
                          <span className="mr-1.5 font-sans text-xs text-fg-subtle md:hidden">Matches</span>
                          {record.matchesWon}–{record.matchesDrawn}–{record.matchesLost}
                        </span>
                        <span className="font-mono text-fg-soft md:text-right">
                          <span className="mr-1.5 font-sans text-xs text-fg-subtle md:hidden">Maps</span>
                          {record.mapsWon}–{record.mapsLost}
                        </span>
                        <span className="font-mono text-fg-soft md:text-right">
                          <span className="mr-1.5 font-sans text-xs text-fg-subtle md:hidden">Rounds</span>
                          {record.roundsWon}–{record.roundsLost}
                        </span>
                        <span className="col-span-3 min-w-0 text-xs md:col-span-1 md:text-sm">
                          {last && record.lastMatch ? (
                            <Link href={last.path} className="flex min-w-0 items-center gap-1.5 text-fg-soft hover:text-fg">
                              {outcome && <span className={cn("font-mono font-bold", outcome.className)}>{outcome.label}</span>}
                              <span className="font-mono">{record.lastMatch.mapsWon}–{record.lastMatch.mapsLost}</span>
                              <span className="truncate">vs {record.lastMatch.opponent ?? "Unknown"}</span>
                              {matchTag(last.match) && <span className="shrink-0 text-fg-subtle">{matchTag(last.match)}</span>}
                              {!record.lastMatch.confirmed && <span className="shrink-0 text-bronze">open</span>}
                            </Link>
                          ) : (
                            <span className="text-fg-subtle">No match yet</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                  {records.length === 0 && <p className="px-3 py-3 text-sm text-fg-subtle">No lineups yet.</p>}
                </div>
                <p className="-mt-3 text-xs text-fg-subtle">Matches: won–drawn–lost. Maps and rounds: won–lost.</p>

                {performers.some((p) => p.performer) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {performers.map(({ title, performer }) => {
                      if (!performer) return null
                      const player = playerByTmId.get(performer.tmId.toLowerCase())
                      const lineup = lineups.find((l) => l.id === performer.lineupId)
                      return (
                        <div key={title} className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
                          <Star size={18} className="shrink-0 text-brand-ink" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{title}</p>
                            <p className="truncate text-sm">
                              {player ? (
                                <Link href={playerPath(player)} className="font-semibold text-fg hover:text-brand-ink">{player.name}</Link>
                              ) : (
                                <span className="font-semibold text-fg">{performer.name}</span>
                              )}
                              {lineup && <span className="text-fg-muted"> · {lineup.name}</span>}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-semibold text-fg">{performer.avgPlace.toFixed(2)}</p>
                            <p className="text-xs text-fg-subtle">avg place · {performer.rounds} rounds</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {mine && (
                  <div className="space-y-3 border-t border-line pt-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-fg">Your Stats</h3>
                      {selfPlayer && (
                        <Link href={playerPath(selfPlayer)} className="inline-flex items-center gap-1 text-xs text-brand-ink hover:underline">
                          All stats on your profile
                          <ChevronRight size={12} />
                        </Link>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <Tile label="Rounds" value={mine.total.roundsPlayed} />
                      <Tile
                        label="Avg place"
                        value={(mine.total.placementSum / mine.total.roundsPlayed).toFixed(2)}
                        hint={mine.formats.map((f) => `${formatLabel(f.format)} ${(f.placementSum / f.roundsPlayed).toFixed(2)}`).join(" · ")}
                      />
                      <Tile
                        label="Pace"
                        value={formatPacePct(mine.total.pace.value)}
                        hint={mine.total.pace.value === null ? "no timed round" : `Team ${formatPacePct(mine.total.pace.team)} · ${mine.total.pace.rank} of ${mine.total.pace.of}`}
                      />
                      <Tile label="Round W/L" value={`${mine.total.roundsWon}–${mine.total.roundsLost}`} hint={`${winRate(mine.total.roundsWon, mine.total.roundsLost)} won`} />
                    </div>
                    {bestMap && (
                      <p className="text-xs text-fg-muted">
                        Best map: <span className="text-fg">{bestMap.track}</span>, avg gap {formatGapSeconds(bestMap.avgGapMs)}
                        {bestMap.avgGapRank !== null && ` · ${bestMap.avgGapRank} of ${bestMap.avgGapOf} in the team`}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )
      })}

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider">Recent Tournaments</h2>
            <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline">
              All tournaments
              <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {recent.map((t) => (
              <Link key={t.id} href={tournamentPath(t)} className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                <span className="block break-words font-semibold text-fg">{t.name}</span>
                <span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-fg-subtle">
                  <Badge variant="purple">{styleLabel(t.style)}</Badge>
                  {t.startDate && <span>{formatDay(t.startDate)}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      </div>
      </div>
    </div>
  )
}
