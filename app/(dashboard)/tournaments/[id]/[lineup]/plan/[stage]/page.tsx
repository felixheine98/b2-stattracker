import { notFound, redirect } from "next/navigation"
import { matchdayPlanningEnabled } from "@/lib/features"
import { mayEditLineup, sessionUser } from "@/lib/lineup-access-db"
import { findPlanLineup, loadPlan } from "@/lib/matchday-plan-db"
import { lineupPath, planPath, tournamentPath } from "@/lib/paths"
import { resolveLineup, resolveTournament } from "@/lib/slugs-db"
import { sortStages, stageDate, stageName } from "@/lib/stages"
import { MatchdayPlanView } from "./matchday-plan-view"

interface Props {
  params: Promise<{ id: string; lineup: string; stage: string }>
}

// The lineup planning of one lineup for one match day (docs/adr/008); only for those who may plan
export default async function MatchdayPlanPage({ params }: Props) {
  if (!matchdayPlanningEnabled()) notFound()
  const { id: tournamentParam, lineup: lineupParam, stage: stageId } = await params
  const tournament = await resolveTournament(tournamentParam)
  const found = tournament && (await resolveLineup(tournament.id, lineupParam))
  if (!tournament || !found) notFound()
  if (tournamentParam !== tournament.slug || lineupParam !== found.slug) redirect(planPath(tournament, found, { id: stageId }))

  const lineup = await findPlanLineup(tournament.id, found.id, stageId)
  if (!lineup) notFound()
  const stages = sortStages(lineup.tournament.stages)
  const stage = stages.find((s) => s.id === stageId)!
  if (stage.type === "SEEDING" || !mayEditLineup(await sessionUser(), lineup)) notFound()

  const plan = await loadPlan(lineup.id, stageId)
  const start = new Date(lineup.tournament.startDate ?? lineup.tournament.createdAt)
  return (
    <MatchdayPlanView
      initial={plan}
      apiPath={`/api/tournaments/${tournament.id}/lineups/${lineup.id}/plan/${stageId}`}
      title={{ lineup: lineup.name, tournament: lineup.tournament.name, stage: stageName(stage, stages), day: stageDate(stage, stages, start).toISOString() }}
      links={{ tournament: tournamentPath(tournament), lineup: lineupPath(tournament, found), addMatch: `${lineupPath(tournament, found)}?addMatch=${stageId}`, match: Object.fromEntries(plan.matches.map((m) => [m.id, `${lineupPath(tournament, found)}/${m.slug ?? m.id}`])) }}
      dayFormats={[...new Set(lineup.tournament.formats.filter((f) => f !== "TIME_ATTACK_10"))]}
    />
  )
}
