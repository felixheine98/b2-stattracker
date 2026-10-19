import type { Prisma } from "@prisma/client"

// One account per player, one player per account: linking moves an account away from another player
// and replaces the player's previous one. Clearing first keeps the unique index happy.
export async function saveDiscordLinks(tx: Prisma.TransactionClient, links: Array<{ discordUserId: string; playerId: string }>) {
  const accounts = links.map(l => l.discordUserId)
  await tx.player.updateMany({ where: { OR: [{ discordUserId: { in: accounts } }, { id: { in: links.map(l => l.playerId) } }] }, data: { discordUserId: null } })
  for (const link of links) await tx.player.update({ where: { id: link.playerId }, data: { discordUserId: link.discordUserId } })
  await tx.discordNonPlayer.deleteMany({ where: { discordUserId: { in: accounts } } })
}
