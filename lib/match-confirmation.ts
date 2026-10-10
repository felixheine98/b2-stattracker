import type { Prisma } from "@prisma/client"
import { OpponentError } from "./opponents-db"
export async function confirmMatch(tx: Prisma.TransactionClient, input: { matchId: string; revision: number; outcome: "W" | "L" | "D"; userId: string }) {
  const changed = await tx.match.updateMany({ where: { id: input.matchId, resultRevision: input.revision }, data: { closedAt: new Date(), confirmedOutcome: input.outcome } })
  if (changed.count !== 1) throw new OpponentError("Die Ergebnisse wurden inzwischen geändert. Bitte neu laden und erneut bestätigen.", 409)
  await tx.matchConfirmation.create({ data: input })
}
