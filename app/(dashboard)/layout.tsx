import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { playerPath } from "@/lib/paths"
import { resolvePlayer } from "@/lib/slugs-db"
import { stylesInUse } from "@/lib/comp-styles"
import { vodArchiveEnabled } from "@/lib/features"
import { redirect } from "next/navigation"
import { MobileTabBar, MobileTopBar } from "@/components/nav/mobile-nav"
import { Sidebar } from "@/components/nav/sidebar"
import { OwnPlayerProvider } from "@/components/own-player"
import { SearchDialog } from "@/components/search/search-dialog"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const role = (session.user as { role?: string }).role ?? "PLAYER"
  const userName = session.user?.name ?? session.user?.email ?? "User"

  // The profile of the player the account belongs to, if any
  const userId = (session.user as { id?: string }).id
  const self = userId ? await db.user.findUnique({ where: { id: userId }, select: { playerId: true, player: { select: { id: true, tmId: true } } } }) : null
  const ownPlayer = self?.playerId ? await resolvePlayer(self.playerId) : null
  const profileHref = ownPlayer ? playerPath(ownPlayer) : null

  // The styles that have tournaments: the entries below "Tournaments" in the sidebar
  const styles = stylesInUse(await db.tournament.findMany({ distinct: ["style"], select: { style: true } }))

  // From 768px on the sidebar; on phones a top bar and a bottom bar around the page
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar userName={userName} role={role} profileHref={profileHref} styles={styles} privacyLink={vodArchiveEnabled()} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar userName={userName} role={role} profileHref={profileHref} privacyLink={vodArchiveEnabled()} />
        {/* Extra room on the left for the sidebar toggle */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden app-content bg-canvas p-4 md:p-8 md:pl-16"><OwnPlayerProvider player={self?.player ?? null}>{children}</OwnPlayerProvider></main>
        <MobileTabBar role={role} profileHref={profileHref} />
      </div>
      <SearchDialog />
    </div>
  )
}
