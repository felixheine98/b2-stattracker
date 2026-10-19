import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { fetchMembers } from "@/lib/discord-bot"
import { suggestPlayer, type DiscordMember } from "@/lib/discord-accounts"
import { allNames } from "@/lib/player-names"
import { currentStatus } from "@/lib/player-status"
import { DiscordAccountsView } from "./discord-accounts-view"

export default async function DiscordAccountsPage() {
  const session = await auth()
  if (!canManage((session?.user as { role?: string })?.role)) redirect("/dashboard")

  const [players, marked, members] = await Promise.all([
    db.player.findMany({ where: { isOpponentOnly: false },
      select: { id: true, name: true, initialName: true, discordUserId: true, initialStatus: true, statusChanges: true, nameChanges: true },
      orderBy: { name: "asc" },
    }),
    db.discordNonPlayer.findMany({ select: { discordUserId: true } }),
    fetchMembers().then(list => ({ list }), (error: unknown) => ({ error: error instanceof Error ? error.message : "The bot could not list the server members." })),
  ])
  const linkedTo = new Map(players.filter(p => p.discordUserId).map(p => [p.discordUserId!, p.id]))
  const notAPlayer = new Set(marked.map(m => m.discordUserId))
  const candidates = players.map(p => ({ id: p.id, names: allNames(p), linked: !!p.discordUserId }))
  const list: DiscordMember[] = "list" in members ? members.list : []
  const onServer = new Set(list.map(m => m.id))

  return <DiscordAccountsView
    error={"error" in members ? members.error : null}
    accounts={[
      ...list.map(m => ({ ...m, onServer: true, playerId: linkedTo.get(m.id) ?? null, notAPlayer: notAPlayer.has(m.id),
        suggestion: linkedTo.has(m.id) || notAPlayer.has(m.id) ? null : suggestPlayer(m, candidates) })),
      // Linked accounts that left the server stay visible, so their link can be lifted
      ...("list" in members ? players.filter(p => p.discordUserId && !onServer.has(p.discordUserId)).map(p => ({
        id: p.discordUserId!, name: p.discordUserId!, username: "", roles: [], onServer: false, playerId: p.id, notAPlayer: false, suggestion: null,
      })) : []),
    ]}
    players={players.map(p => ({ id: p.id, name: p.name, allNames: allNames(p), status: currentStatus(p), discordUserId: p.discordUserId }))}
  />
}
