import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/nav/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const role = (session.user as { role?: string }).role ?? "PLAYER"

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={session.user?.name ?? session.user?.email ?? "User"} role={role} />
      {/* Extra room on the left for the sidebar toggle */}
      <main className="flex-1 overflow-y-auto bg-[#0e0b0b] p-6 pl-14">{children}</main>
    </div>
  )
}
