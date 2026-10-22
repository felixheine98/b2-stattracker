// Loading and saving the lineup planning of a match day (docs/adr/008); the rules are in lib/matchday-plan.ts
import type { Prisma } from "@prisma/client"
import { db } from "./db"
import { LINEUP_ACCESS_SELECT } from "./lineup-access-db"
import type { MatchdayAnswer, PlanVariant } from "./matchday-plan"
import { sortMatches } from "./match-order"
import type { Format } from "@/types"

// The lineup with what deciding about access needs, if the stage belongs to its tournament
export async function findPlanLineup(tournamentId: string, lineupId: string, stageId: string) {
  const lineup = await db.tournamentLineup.findUnique({
    where: { id: lineupId, tournamentId },
    select: { id: true, name: true, ...LINEUP_ACCESS_SELECT, tournament: { select: { ...LINEUP_ACCESS_SELECT.tournament.select, formats: true, stages: { select: { id: true, type: true, number: true } } } } },
  })
  if (!lineup || !lineup.tournament.stages.some((s) => s.id === stageId)) return null
  return lineup
}

export const emptyVariant = (): PlanVariant => ({ day: {}, matches: {} })

// The planning with everything the page shows; started on first use with one variant
export async function loadPlan(lineupId: string, stageId: string) {
  const plan = await db.matchdayPlan.upsert({
    where: { lineupId_stageId: { lineupId, stageId } },
    create: { lineupId, stageId, variants: { create: { name: "Lineup", seats: emptyVariant() as unknown as Prisma.InputJsonValue } } },
    update: {},
    include: {
      answers: true,
      absences: true,
      variants: { orderBy: { createdAt: "asc" } },
    },
  })
  const [kader, matches] = await Promise.all([
    db.tournamentLineupSlot.findMany({ where: { lineupId }, select: { player: { select: { id: true, name: true, slug: true } } }, orderBy: { player: { name: "asc" } } }),
    db.match.findMany({
      where: { tournamentLineupId: lineupId, stageId },
      select: { id: true, slug: true, number: true, label: true, opponent: true, date: true, createdAt: true, subMatches: { orderBy: { order: "asc" }, select: { format: true } } },
    }),
  ])
  return {
    planId: plan.id,
    kader: kader.map((s) => s.player),
    matches: sortMatches(matches).map(({ subMatches, ...m }) => ({ ...m, formats: subMatches.map((sm) => sm.format as Format) })),
    answers: Object.fromEntries(plan.answers.map((a) => [a.playerId, { answer: a.answer as MatchdayAnswer | null, note: a.note, answeredAt: a.answeredAt }])),
    absences: plan.absences.map((a) => ({ playerId: a.playerId, matchId: a.matchId })),
    variants: plan.variants.map((v) => ({ id: v.id, name: v.name, seats: v.seats as unknown as PlanVariant })),
    published: plan.published as unknown as PlanVariant | null,
    publishedVariantId: plan.publishedVariantId,
    publishedAt: plan.publishedAt,
  }
}

export type LoadedPlan = Awaited<ReturnType<typeof loadPlan>>
