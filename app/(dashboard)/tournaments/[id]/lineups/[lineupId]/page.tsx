import { lineupPath } from "@/lib/paths"
import { resolveLineup, resolveTournament } from "@/lib/slugs-db"
import { notFound, redirect } from "next/navigation"

interface Props {
  params: Promise<{ id: string; lineupId: string }>
}

// Former address of the lineup page (/tournaments/<id>/lineups/<id>): old links are sent on
export default async function OldLineupPage({ params }: Props) {
  const { id, lineupId } = await params
  const tournament = await resolveTournament(id)
  const lineup = tournament && (await resolveLineup(tournament.id, lineupId))
  if (!tournament || !lineup) notFound()
  redirect(lineupPath(tournament, lineup))
}
