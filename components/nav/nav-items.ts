import { LayoutDashboard, ShieldCheck, Trophy, Users } from "lucide-react"

// The pages of the app, shown in the sidebar and in the bottom bar on phones
export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
]

// Only for admins and managers
export const accountsItem = { href: "/admin", label: "Accounts", icon: ShieldCheck }

export const canSeeAccounts = (role: string) => role === "ADMIN" || role === "MANAGER"
