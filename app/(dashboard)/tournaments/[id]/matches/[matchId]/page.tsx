import { db } from "@/lib/db"
import { matchPath } from "@/lib/paths"
import { resolveTournament } from "@/lib/slugs-db"
import { notFound, redirect } from "next/navigation"

interface Props {
  params: Promise<{ id: string; matchId: string }>
}

// Former address of the match page (/tournaments/<id>/matches/<id>): old links are sent on
export default async function OldMatchPage({ params }: Props) {
  const { id, matchId } = await params
  const tournament = await resolveTournament(id)
  const match = tournament
    ? await db.match.findFirst({
        where: { id: matchId, tournamentId: tournament.id },
        select: { id: true, slug: true, tournamentLineup: { select: { id: true, slug: true } } },
      })
    : null
  if (!tournament || !match?.tournamentLineup) notFound()
  redirect(matchPath(tournament, match.tournamentLineup, match))
}
