import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { TfhImportView } from "./tfh-import-view"

export default async function TfhImportPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/tournaments")
  const players = await db.player.findMany({ where: { isOpponentOnly: false }, orderBy: { name: "asc" }, select: { id: true, name: true, tmId: true } })
  return <TfhImportView players={players} initialUrl={(await searchParams).url ?? ""} />
}
