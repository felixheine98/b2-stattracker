import { permanentRedirect } from "next/navigation"

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

// The planning page used to live here under its German name; links that were shared keep working
export default async function OldPlanningPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams
  permanentRedirect(`/tournaments/${id}/planning${tab === "varianten" ? "?tab=lineups" : ""}`)
}
