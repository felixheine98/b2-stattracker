import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AdminView } from "./admin-view"

export default async function AdminPage() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (role !== "ADMIN") redirect("/dashboard")

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      player: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const currentUserId = (session?.user as { id?: string })?.id ?? ""

  return <AdminView users={users} currentUserId={currentUserId} />
}
