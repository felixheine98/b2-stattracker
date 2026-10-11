import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { playerPath } from "@/lib/paths"
import { resolvePlayer } from "@/lib/slugs-db"
import { redirect } from "next/navigation"
import { MobileTabBar, MobileTopBar } from "@/components/nav/mobile-nav"
import { Sidebar } from "@/components/nav/sidebar"
import { SearchDialog } from "@/components/search/search-dialog"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const role = (session.user as { role?: string }).role ?? "PLAYER"
  const userName = session.user?.name ?? session.user?.email ?? "User"

  // The profile of the player the account belongs to, if any
  const userId = (session.user as { id?: string }).id
  const self = userId ? await db.user.findUnique({ where: { id: userId }, select: { playerId: true } }) : null
  const ownPlayer = self?.playerId ? await resolvePlayer(self.playerId) : null
  const profileHref = ownPlayer ? playerPath(ownPlayer) : null

  // From 768px on the sidebar; on phones a top bar and a bottom bar around the page
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar userName={userName} role={role} profileHref={profileHref} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar userName={userName} role={role} profileHref={profileHref} />
        {/* Extra room on the left for the sidebar toggle */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0e0b0b] p-4 md:p-6 md:pl-14">{children}</main>
        <MobileTabBar role={role} profileHref={profileHref} />
      </div>
      <SearchDialog />
    </div>
  )
}
