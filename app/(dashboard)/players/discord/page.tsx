import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { fetchMembers, fetchTrackedMessages } from "@/lib/discord-bot"
import { plannedAnnouncements } from "@/lib/reaction-log-db"
import { describeTracked } from "@/lib/reaction-log"
import { suggestPlayer, type DiscordMember } from "@/lib/discord-accounts"
import { allNames } from "@/lib/player-names"
import { currentStatus } from "@/lib/player-status"
import { DiscordAccountsView } from "./discord-accounts-view"
import { ReactionLog } from "./reaction-log"

export default async function DiscordAccountsPage() {
  const session = await auth()
  if (!canManage((session?.user as { role?: string })?.role)) redirect("/dashboard")

  const [players, marked, members, tracked, plannings, openComps] = await Promise.all([
    db.player.findMany({ where: { isOpponentOnly: false },
      select: { id: true, name: true, nickname: true, initialName: true, discordUserId: true, initialStatus: true, statusChanges: true, nameChanges: true },
      orderBy: { name: "asc" },
    }),
    db.discordNonPlayer.findMany({ select: { discordUserId: true } }),
    fetchMembers().then(list => ({ list }), (error: unknown) => ({ error: error instanceof Error ? error.message : "The bot could not list the server members." })),
    fetchTrackedMessages().then(list => ({ list }), (error: unknown) => ({ error: error instanceof Error ? error.message : "The bot could not list the tracked messages." })),
    plannedAnnouncements(),
    // The comps that can still take a link
    db.tournament.findMany({ where: { planning: { isNot: null }, tournamentLineups: { none: {} } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, planning: { select: { discordSettings: true } } } }),
  ])
  const linkedTo = new Map(players.filter(p => p.discordUserId).map(p => [p.discordUserId!, p.id]))
  const notAPlayer = new Set(marked.map(m => m.discordUserId))
  const candidates = players.map(p => ({ id: p.id, names: allNames(p), linked: !!p.discordUserId }))
  const list: DiscordMember[] = "list" in members ? members.list : []
  const onServer = new Set(list.map(m => m.id))

  return <>
  <DiscordAccountsView
    error={"error" in members ? members.error : null}
    accounts={[
      ...list.map(m => ({ ...m, onServer: true, playerId: linkedTo.get(m.id) ?? null, notAPlayer: notAPlayer.has(m.id),
        suggestion: linkedTo.has(m.id) || notAPlayer.has(m.id) ? null : suggestPlayer(m, candidates) })),
      // Linked accounts that left the server stay visible, so their link can be lifted
      ...("list" in members ? players.filter(p => p.discordUserId && !onServer.has(p.discordUserId)).map(p => ({
        id: p.discordUserId!, name: p.discordUserId!, username: "", roles: [], onServer: false, playerId: p.id, notAPlayer: false, suggestion: null,
      })) : []),
    ]}
    players={players.map(p => ({ id: p.id, name: p.name, nickname: p.nickname, allNames: allNames(p), status: currentStatus(p), discordUserId: p.discordUserId }))}
  />
  <div className="page-wide pt-6">
    <ReactionLog
      comps={openComps.map(c => ({ id: c.id, name: c.name, messageUrl: (c.planning?.discordSettings as { messageUrl?: string } | null)?.messageUrl ?? "" }))}
      error={"error" in tracked ? tracked.error : null}
      rows={"list" in tracked ? describeTracked(tracked.list.guildId, tracked.list.messages, plannings) : []}
    />
  </div>
  </>
}
