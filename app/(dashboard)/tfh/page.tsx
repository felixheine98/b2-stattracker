import { db } from "@/lib/db"
import { getTfhB2Results } from "@/lib/tfh-db"
import { TfhTotalsView } from "@/components/tfh/totals-view"

// All B2 drivers over all archived TFH editions; the exact ranking of one race is on its own page
export default async function TfhTotalsPage() {
  const [results, races] = await Promise.all([
    getTfhB2Results(),
    db.tfhRace.findMany({ orderBy: { tournament: { startDate: "desc" } }, select: { id: true, kind: true, tournament: { select: { id: true, name: true, slug: true } } } }),
  ])
  const players = [...new Map(results.map(r => [r.player.id, r.player])).values()]

  return (
    <TfhTotalsView
      results={results.map(r => ({ playerId: r.playerId, raceId: r.team.race.id, kind: r.team.race.kind, checkpoints: r.checkpoints, playTimeSeconds: r.playTimeSeconds, finishes: r._count.finishes, cpm: r.cpm }))}
      players={players}
      races={races.map(r => ({ id: r.id, name: r.tournament.name, kind: r.kind, tournament: { id: r.tournament.id, slug: r.tournament.slug } }))}
    />
  )
}
