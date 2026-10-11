import { reopenMatch, resolveOpponentPlayer } from "@/lib/opponents-db"
import type { Player, Prisma } from "@prisma/client"

export interface ImportBlock {
  subMatchId: string
  track?: string | null
  rounds: Array<{
    // Unix time in seconds, 0 when unknown
    time: number
    // In finishing order
    results: Array<{ tmId: string; name: string; timeMs: number | null; dnf: boolean; isOurTeam: boolean }>
  }>
}

// Write the rounds of an import of a whole match (see lib/match-csv.ts). Per block the rounds
// of its sub-match are replaced and its lineup becomes whoever of ours drove in it. known are
// our players among the drivers; guests are drivers of ours who are added on the way.
export async function saveMatchImport(
  tx: Prisma.TransactionClient,
  match: { id: string; opponentLineupId: string | null },
  blocks: ImportBlock[],
  known: Player[],
  guests: Array<{ tmId: string; name: string }>
): Promise<void> {
  const ours = new Map(known.map((p) => [p.tmId.toLowerCase(), p]))
  for (const guest of guests) {
    const tmId = guest.tmId.toLowerCase()
    // Someone we only knew as an opponent becomes a guest of ours; their rounds against us stay
    const data = { name: guest.name, isOpponentOnly: false, initialStatus: "GUEST" as const }
    const player = await tx.player.upsert({ where: { tmId }, update: data, create: { ...data, tmId, initialName: guest.name } })
    ours.set(tmId, player)
  }

  await reopenMatch(tx, match.id)
  for (const block of blocks) {
    await tx.round.deleteMany({ where: { subMatchId: block.subMatchId } })

    // The lineup of the sub-match is whoever of ours drove in it
    const playerIds = [...new Set(block.rounds.flatMap((r) => r.results.filter((x) => x.isOurTeam).map((x) => ours.get(x.tmId.toLowerCase())!.id)))]
    const slots = { create: playerIds.map((playerId) => ({ playerId })) }
    await tx.lineup.upsert({
      where: { subMatchId: block.subMatchId },
      create: { subMatchId: block.subMatchId, slots },
      update: { slots: { deleteMany: {}, ...slots } },
    })

    for (const [number, round] of block.rounds.entries()) {
      const results = []
      for (const [i, result] of round.results.entries()) {
        const tmId = result.tmId.toLowerCase()
        const timing = { position: i + 1, timeMs: result.dnf ? null : result.timeMs, dnf: result.dnf }
        if (result.isOurTeam) {
          const player = ours.get(tmId)!
          results.push({ tmId: player.tmId, playerName: player.name, playerId: player.id, isOurTeam: true, ...timing })
        } else {
          const person = await resolveOpponentPlayer(tx, match.opponentLineupId, tmId, result.name, { subMatchId: block.subMatchId, number })
          results.push({ tmId: person?.tmId ?? tmId, playerName: result.name, playerId: person?.id ?? null, isOurTeam: false, ...timing })
        }
      }
      await tx.round.create({
        data: {
          subMatchId: block.subMatchId,
          number,
          track: block.track || null,
          timestamp: round.time > 0 ? new Date(round.time * 1000) : null,
          results: { create: results },
        },
      })
    }
  }
}
