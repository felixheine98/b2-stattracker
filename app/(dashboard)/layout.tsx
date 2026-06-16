import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/nav/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={session.user?.name ?? session.user?.email ?? "User"} />
      <main className="flex-1 overflow-y-auto bg-slate-950 p-6">{children}</main>
    </div>
  )
}
