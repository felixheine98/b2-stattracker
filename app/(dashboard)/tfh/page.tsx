import { db } from "@/lib/db"
import { getTfhB2Results } from "@/lib/tfh-db"
import { TfhTotalsView } from "@/components/tfh/totals-view"

// All B2 drivers over all archived TFH editions; the ranking by pace is on the page of each race
export default async function TfhTotalsPage() {
  const [results, races] = await Promise.all([
    getTfhB2Results(),
    db.tfhRace.findMany({ orderBy: { tournament: { startDate: "desc" } }, select: { id: true, tournament: { select: { id: true, name: true, slug: true } } } }),
  ])
  const players = [...new Map(results.map(r => [r.player.id, r.player])).values()]

  return (
    <TfhTotalsView
      results={results.map(r => ({ playerId: r.playerId, raceId: r.team.race.id, checkpoints: r.checkpoints, playTimeSeconds: r.playTimeSeconds }))}
      players={players}
      races={races.map(r => ({ id: r.tournament.id, name: r.tournament.name, slug: r.tournament.slug }))}
    />
  )
}
